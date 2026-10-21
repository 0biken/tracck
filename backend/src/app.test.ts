import 'reflect-metadata';
import { Global, Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiError, JobStore } from '@tracck/shared';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import type { ApiEnv } from './config/env';
import { ConnectionsModule } from './connections/connections.module';
import { ENV, JOB_EVENTS, JOB_QUEUE, JOB_STORE, NOTIFY_JOB, STREAM_POLL_MS, VERIFY_TOKEN } from './tokens';
import { FakeJobQueue, createTestDatabase, createTestUser, type PGlite } from './testing';

let db: PGlite;
let store: JobStore;
let queue: FakeJobQueue;
let app: INestApplication;
let userId: string;
let otherUserId: string;

/** In-memory stand-ins for PostgreSQL and Redis, in place of the real connections module. */
function fakeConnections() {
  const providers = [
    { provide: JOB_STORE, useValue: store },
    { provide: JOB_QUEUE, useValue: queue },
    { provide: JOB_EVENTS, useValue: { subscribe: () => () => {} } },
    { provide: NOTIFY_JOB, useValue: async () => {} },
  ];
  @Global()
  @Module({ providers, exports: providers.map((provider) => provider.provide) })
  class FakeConnectionsModule {}
  return FakeConnectionsModule;
}

async function createApp(options: { enableDiagnosticJobs: boolean }) {
  const env: ApiEnv = {
    PORT: 0,
    DATABASE_URL: 'unused',
    REDIS_URL: 'unused',
    SUPABASE_URL: 'https://example.supabase.co',
    APP_ORIGIN: 'http://localhost:3000',
    ENABLE_DIAGNOSTIC_JOBS: options.enableDiagnosticJobs ? 'true' : 'false',
    RUN_JOB_WORKER: 'false',
    WORKER_CONCURRENCY: 1,
    RECONCILE_INTERVAL_SECONDS: 30,
  };

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideModule(ConnectionsModule)
    .useModule(fakeConnections())
    .overrideProvider(ENV)
    .useValue(env)
    // Tokens in these tests are simply "token-<userId>".
    .overrideProvider(VERIFY_TOKEN)
    .useValue(async (token: string) => {
      if (!token.startsWith('token-')) throw new ApiError(401, 'UNAUTHORIZED', 'Sign in to continue.');
      return { userId: token.slice('token-'.length) };
    })
    .overrideProvider(STREAM_POLL_MS)
    .useValue(50)
    .compile();

  const created = moduleRef.createNestApplication();
  configureApp(created, { appOrigin: env.APP_ORIGIN });
  await created.init();
  return created;
}

beforeAll(async () => {
  db = await createTestDatabase();
  store = new JobStore(db);
  queue = new FakeJobQueue();
  userId = await createTestUser(db);
  otherUserId = await createTestUser(db);
  app = await createApp({ enableDiagnosticJobs: true });
});

afterAll(() => app.close());

const http = () => request(app.getHttpServer());
const as = (id: string) => ({ authorization: `Bearer token-${id}` });

const createJob = (headers: Record<string, string>, payload: object = { stepDelayMs: 0 }) =>
  http().post('/v1/diagnostic-jobs').set(headers).send(payload);

describe('API', () => {
  it('rejects requests without a valid token, in the error envelope', async () => {
    for (const headers of [{}, { authorization: 'Bearer nope' }]) {
      const response = await http().get(`/v1/jobs/${crypto.randomUUID()}`).set(headers);
      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Sign in to continue.',
          correlationId: response.headers['x-correlation-id'],
        },
      });
    }
  });

  it('requires an idempotency key to create a job', async () => {
    const response = await createJob(as(userId));
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('rejects unknown fields', async () => {
    const response = await createJob(
      { ...as(userId), 'idempotency-key': crypto.randomUUID() },
      { userId: otherUserId },
    );
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('accepts a job with 202, persists it, and enqueues it once across repeats', async () => {
    const headers = { ...as(userId), 'idempotency-key': crypto.randomUUID() };
    const first = await createJob(headers);
    const second = await createJob(headers);

    expect(first.status).toBe(202);
    const { jobId, statusUrl, eventsUrl } = first.body;
    expect(second.body.jobId).toBe(jobId);
    expect(statusUrl).toBe(`/v1/jobs/${jobId}`);
    expect(eventsUrl).toBe(`/v1/jobs/${jobId}/events`);

    expect(await store.get(jobId)).toMatchObject({ status: 'queued', userId });
    expect([...queue.entries.keys()].filter((key) => key.startsWith(jobId))).toEqual([`${jobId}_1`]);
  });

  it('still accepts the job when the queue is down, and records why', async () => {
    queue.failNextEnqueue = true;
    const response = await createJob({ ...as(userId), 'idempotency-key': crypto.randomUUID() });
    expect(response.status).toBe(202);
    const job = await store.get(response.body.jobId);
    expect(job).toMatchObject({ status: 'queued' });
    expect(job!.enqueueError).toContain('Redis is unavailable');
  });

  it('answers the same for a missing job and another user’s job', async () => {
    const created = await createJob({ ...as(userId), 'idempotency-key': crypto.randomUUID() });
    const { jobId } = created.body;

    const theirs = await http().get(`/v1/jobs/${jobId}`).set(as(otherUserId));
    const missing = await http().get(`/v1/jobs/${crypto.randomUUID()}`).set(as(otherUserId));
    expect(theirs.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(theirs.body.error.message).toBe(missing.body.error.message);

    const cancel = await http().post(`/v1/jobs/${jobId}/cancel`).set(as(otherUserId));
    expect(cancel.status).toBe(404);
    expect((await store.get(jobId))!.status).toBe('queued');
  });

  it('returns job state without internal fields', async () => {
    const created = await createJob({ ...as(userId), 'idempotency-key': crypto.randomUUID() });
    const response = await http().get(created.body.statusUrl).set(as(userId));
    const view = response.body;
    expect(view).toMatchObject({ status: 'queued', type: 'diagnostic', canCancel: true, canRetry: false });
    expect(view).not.toHaveProperty('userId');
    expect(view).not.toHaveProperty('idempotencyKey');
    expect(view).not.toHaveProperty('enqueueError');
  });

  it('cancels a queued job once, then reports a conflict', async () => {
    const created = await createJob({ ...as(userId), 'idempotency-key': crypto.randomUUID() });
    const url = `/v1/jobs/${created.body.jobId}/cancel`;

    const first = await http().post(url).set(as(userId));
    expect(first.status).toBe(202);
    expect(first.body.status).toBe('cancelled');

    const second = await http().post(url).set(as(userId));
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('JOB_NOT_CANCELLABLE');
  });

  it('retries only failed jobs', async () => {
    const created = await createJob({ ...as(userId), 'idempotency-key': crypto.randomUUID() });
    const { jobId } = created.body;
    const url = `/v1/jobs/${jobId}/retry`;

    const early = await http().post(url).set(as(userId));
    expect(early.status).toBe(409);
    expect(early.body.error.code).toBe('JOB_NOT_RETRYABLE');

    await store.markRunning(jobId);
    await store.fail(jobId, 1, 'BUILD_FAILED', 'We could not finish this.');
    queue.entries.clear();

    const retried = await http().post(url).set(as(userId));
    expect(retried.status).toBe(202);
    expect(retried.body).toMatchObject({ status: 'queued', attemptCount: 0, error: null });
    expect(await queue.has(jobId, 1)).toBe(true);
  });

  it('streams job state as server-sent events and ends when the job settles', async () => {
    const created = await createJob({ ...as(userId), 'idempotency-key': crypto.randomUUID() });
    const { jobId, eventsUrl } = created.body;

    // The job finishes shortly after the stream opens. The stream's own polling picks it up.
    setTimeout(async () => {
      await store.markRunning(jobId);
      await store.setStep(jobId, 1, 'normalize', 50);
      await store.succeed(jobId, 1, {});
    }, 100);

    const response = await http().get(eventsUrl).set(as(userId));
    expect(response.headers['content-type']).toContain('text/event-stream');

    const events = response.text
      .split('\n\n')
      .filter((block) => block.startsWith('id:'))
      .map((block) => ({
        id: Number(block.match(/^id: (\d+)/)![1]),
        job: JSON.parse(block.match(/^data: (.+)$/m)![1]),
      }));

    expect(events[0].job.status).toBe('queued');
    expect(events.at(-1)!.job.status).toBe('succeeded');
    const ids = events.map((event) => event.id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('skips events the client has already seen', async () => {
    const created = await createJob({ ...as(userId), 'idempotency-key': crypto.randomUUID() });
    const { jobId, eventsUrl } = created.body;
    await store.requestCancel(jobId, userId);
    const version = (await store.get(jobId))!.version;

    const response = await http()
      .get(eventsUrl)
      .set({ ...as(userId), 'last-event-id': String(version) });
    expect(response.text).not.toContain('event: job');
  });

  it('answers unknown addresses in the error envelope', async () => {
    const response = await http().get('/nope');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('does not expose the diagnostic route unless it is enabled', async () => {
    const closed = await createApp({ enableDiagnosticJobs: false });
    const response = await request(closed.getHttpServer())
      .post('/v1/diagnostic-jobs')
      .set({ ...as(userId), 'idempotency-key': crypto.randomUUID() })
      .send({});
    expect(response.status).toBe(404);
    await closed.close();
  });
});
