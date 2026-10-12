import { randomUUID } from 'node:crypto';
import cors from '@fastify/cors';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  ApiError,
  QUEUE_SCHEMA_VERSION,
  errorEnvelope,
  isSettled,
  toJobView,
  type JobQueue,
  type JobRecord,
  type JobStore,
} from '@tracck/core';
import { bearerToken, type VerifyToken } from './auth';
import type { JobEvents } from './events';

export interface AppDeps {
  store: JobStore;
  queue: JobQueue;
  events: JobEvents;
  verifyToken: VerifyToken;
  appOrigin: string;
  enableDiagnosticJobs: boolean;
  /** How often an open stream re-reads the job, in case a pub/sub message was lost. */
  streamPollMs?: number;
  logger?: boolean;
}

const jobParams = z.strictObject({ jobId: z.uuid() });
const diagnosticBody = z.strictObject({ stepDelayMs: z.number().int().min(0).max(5000).optional() });
const idempotencyKey = z.string().min(8).max(200);

function jobUrls(jobId: string) {
  return { statusUrl: `/v1/jobs/${jobId}`, eventsUrl: `/v1/jobs/${jobId}/events` };
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const { store, queue } = deps;

  const app = Fastify({
    logger: deps.logger ?? false,
    // The request ID doubles as the correlation ID in error envelopes and job rows.
    genReqId: () => randomUUID(),
  });

  await app.register(cors, {
    origin: deps.appOrigin,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key', 'Last-Event-ID'],
    exposedHeaders: ['X-Correlation-Id'],
  });

  app.addHook('onRequest', async (request, reply) => {
    reply.header('X-Correlation-Id', request.id);
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      return reply.status(error.status).send(errorEnvelope(error.code, error.message, request.id));
    }
    if (error instanceof z.ZodError) {
      return reply
        .status(400)
        .send(errorEnvelope('VALIDATION_ERROR', 'Check the request and try again.', request.id));
    }
    const status = (error as { statusCode?: number }).statusCode;
    if (status && status >= 400 && status < 500) {
      return reply
        .status(status)
        .send(errorEnvelope('VALIDATION_ERROR', 'Check the request and try again.', request.id));
    }
    request.log.error({ errorName: (error as Error).name }, 'unhandled error');
    return reply
      .status(500)
      .send(errorEnvelope('INTERNAL_ERROR', 'Something went wrong on our side. Try again.', request.id));
  });

  app.setNotFoundHandler((request, reply) =>
    reply.status(404).send(errorEnvelope('NOT_FOUND', 'That address does not exist.', request.id)),
  );

  async function authenticate(request: FastifyRequest): Promise<string> {
    const { userId } = await deps.verifyToken(bearerToken(request.headers.authorization));
    return userId;
  }

  // A missing job and someone else's job get the same answer (§9, "API rules").
  async function loadJob(request: FastifyRequest, userId: string): Promise<JobRecord> {
    const { jobId } = jobParams.parse(request.params);
    const job = await store.getForUser(jobId, userId);
    if (!job) throw new ApiError(404, 'NOT_FOUND', 'We could not find that job.');
    return job;
  }

  async function enqueue(job: JobRecord): Promise<void> {
    try {
      await queue.enqueue(
        { jobId: job.id, userId: job.userId, type: job.jobType, schemaVersion: QUEUE_SCHEMA_VERSION },
        job.attemptCount + 1,
      );
    } catch (error) {
      // The job is already durable. The worker's reconciler will enqueue it later.
      await store.recordEnqueueError(job.id, String(error)).catch(() => {});
    }
  }

  app.get('/healthz', async () => ({ ok: true }));

  if (deps.enableDiagnosticJobs) {
    app.post('/v1/diagnostic-jobs', async (request, reply) => {
      const userId = await authenticate(request);
      const key = idempotencyKey.safeParse(request.headers['idempotency-key']);
      if (!key.success) {
        throw new ApiError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Send an Idempotency-Key header with this request.');
      }
      const body = diagnosticBody.parse(request.body ?? {});

      const { job, created } = await store.create({
        userId,
        jobType: 'diagnostic',
        idempotencyKey: key.data,
        inputRef: body,
        correlationId: request.id,
      });
      if (created) await enqueue(job);

      return reply.status(202).send({ jobId: job.id, ...jobUrls(job.id) });
    });
  }

  app.get('/v1/jobs/:jobId', async (request) => {
    const userId = await authenticate(request);
    return toJobView(await loadJob(request, userId));
  });

  app.post('/v1/jobs/:jobId/cancel', async (request, reply) => {
    const userId = await authenticate(request);
    const job = await loadJob(request, userId);
    const updated = await store.requestCancel(job.id, userId);
    if (!updated) throw new ApiError(409, 'JOB_NOT_CANCELLABLE', 'This job has already finished.');
    return reply.status(202).send(toJobView(updated));
  });

  app.post('/v1/jobs/:jobId/retry', async (request, reply) => {
    const userId = await authenticate(request);
    const job = await loadJob(request, userId);
    const updated = await store.requeueFailed(job.id, userId);
    if (!updated) throw new ApiError(409, 'JOB_NOT_RETRYABLE', 'Only a failed job can be retried.');
    await enqueue(updated);
    return reply.status(202).send(toJobView(updated));
  });

  // Server-Sent Events. Each event reports persisted state and carries the job's
  // version as its ID, so a reconnecting client can send Last-Event-ID and skip
  // what it has already seen. GET /v1/jobs/:jobId stays the source of truth.
  app.get('/v1/jobs/:jobId/events', async (request, reply) => {
    const userId = await authenticate(request);
    const job = await loadJob(request, userId);

    reply.hijack();
    const stream = reply.raw;
    // Headers set so far (CORS, correlation ID) are not sent automatically once hijacked.
    for (const [name, value] of Object.entries(reply.getHeaders())) {
      if (value !== undefined) stream.setHeader(name, value);
    }
    stream.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    let lastVersion = Number(request.headers['last-event-id']) || 0;
    let closed = false;
    let pending: Promise<void> = Promise.resolve();

    const close = () => {
      if (closed) return;
      closed = true;
      clearInterval(poll);
      clearInterval(keepAlive);
      unsubscribe();
      stream.end();
    };

    const emit = (current: JobRecord) => {
      if (current.version > lastVersion) {
        lastVersion = current.version;
        stream.write(`id: ${current.version}\nevent: job\ndata: ${JSON.stringify(toJobView(current))}\n\n`);
      }
      if (isSettled(current.status)) close();
    };

    // Reads are chained so two signals close together cannot write out of order.
    const refresh = () => {
      pending = pending
        .then(async () => {
          if (closed) return;
          const current = await store.getForUser(job.id, userId);
          if (current) emit(current);
          else close();
        })
        .catch(() => close());
    };

    const unsubscribe = deps.events.subscribe(job.id, refresh);
    const poll = setInterval(refresh, deps.streamPollMs ?? 5_000);
    const keepAlive = setInterval(() => stream.write(': keep-alive\n\n'), 20_000);
    stream.on('close', close);

    emit(job);
  });

  return app;
}
