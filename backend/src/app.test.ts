import type { PGlite } from './testing';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiError, JobStore } from '@tracck/shared';
import { FakeJobQueue, createTestDatabase, createTestUser } from './testing';
import { buildApp } from './app';

let db: PGlite;
let store: JobStore;
let queue: FakeJobQueue;
let app: FastifyInstance;
let userId: string;
let otherUserId: string;

beforeAll(async () => {
  db = await createTestDatabase();
  store = new JobStore(db);
  queue = new FakeJobQueue();
  userId = await createTestUser(db);
  otherUserId = await createTestUser(db);

  app = await buildApp({
    store,
    queue,
    events: { subscribe: () => () => {} },
    // Tokens in these tests are simply "token-<userId>".
    verifyToken: async (token) => {
      if (!token.startsWith('token-')) throw new ApiError(401, 'UNAUTHORIZED', 'Sign in to continue.');
      return { userId: token.slice('token-'.length) };
    },
    appOrigin: 'http://localhost:3000',
    enableDiagnosticJobs: true,
    streamPollMs: 50,
  });
});

afterAll(() => app.close());

const as = (id: string) => ({ authorization: `Bearer token-${id}` });

const createJob = (headers: Record<string, string>, payload: object = { stepDelayMs: 0 }) =>
  app.inject({ method: 'POST', url: '/v1/diagnostic-jobs', headers, payload });

describe('API', () => {
  it('rejects requests without a valid token, in the error envelope', async () => {
    for (const headers of [{}, { authorization: 'Bearer nope' }]) {
      const response = await app.inject({ method: 'GET', url: `/v1/jobs/${crypto.randomUUID()}`, headers });
      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({
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
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('rejects unknown fields', async () => {
    const response = await createJob(
      { ...as(userId), 'idempotency-key': crypto.randomUUID() },
      { userId: otherUserId },
    );
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('accepts a job with 202, persists it, and enqueues it once across repeats', async () => {
    const headers = { ...as(userId), 'idempotency-key': crypto.randomUUID() };
    const first = await createJob(headers);
    const second = await createJob(headers);

    expect(first.statusCode).toBe(202);
    const { jobId, statusUrl, eventsUrl } = first.json();
    expect(second.json().jobId).toBe(jobId);
    expect(statusUrl).toBe(`/v1/jobs/${jobId}`);
    expect(eventsUrl).toBe(`/v1/jobs/${jobId}/events`);

    expect(await store.get(jobId)).toMatchObject({ status: 'queued', userId });
    expect([...queue.entries.keys()].filter((key) => key.startsWith(jobId))).toEqual([`${jobId}_1`]);
  });

  it('still accepts the job when the queue is down, and records why', async () => {
    queue.failNextEnqueue = true;
    const response = await createJob({ ...as(userId), 'idempotency-key': crypto.randomUUID() });
    expect(response.statusCode).toBe(202);
    const job = await store.get(response.json().jobId);
    expect(job).toMatchObject({ status: 'queued' });
    expect(job!.enqueueError).toContain('Redis is unavailable');
  });

  it('answers the same for a missing job and another user’s job', async () => {
    const created = await createJob({ ...as(userId), 'idempotency-key': crypto.randomUUID() });
    const { jobId } = created.json();

    const theirs = await app.inject({ method: 'GET', url: `/v1/jobs/${jobId}`, headers: as(otherUserId) });
    const missing = await app.inject({
      method: 'GET',
      url: `/v1/jobs/${crypto.randomUUID()}`,
      headers: as(otherUserId),
    });
    expect(theirs.statusCode).toBe(404);
    expect(missing.statusCode).toBe(404);
    expect(theirs.json().error.message).toBe(missing.json().error.message);

    const cancel = await app.inject({ method: 'POST', url: `/v1/jobs/${jobId}/cancel`, headers: as(otherUserId) });
    expect(cancel.statusCode).toBe(404);
    expect((await store.get(jobId))!.status).toBe('queued');
  });

  it('returns job state without internal fields', async () => {
    const created = await createJob({ ...as(userId), 'idempotency-key': crypto.randomUUID() });
    const response = await app.inject({ method: 'GET', url: created.json().statusUrl, headers: as(userId) });
    const view = response.json();
    expect(view).toMatchObject({ status: 'queued', type: 'diagnostic', canCancel: true, canRetry: false });
    expect(view).not.toHaveProperty('userId');
    expect(view).not.toHaveProperty('idempotencyKey');
    expect(view).not.toHaveProperty('enqueueError');
  });

  it('cancels a queued job once, then reports a conflict', async () => {
    const created = await createJob({ ...as(userId), 'idempotency-key': crypto.randomUUID() });
    const url = `/v1/jobs/${created.json().jobId}/cancel`;

    const first = await app.inject({ method: 'POST', url, headers: as(userId) });
    expect(first.statusCode).toBe(202);
    expect(first.json().status).toBe('cancelled');

    const second = await app.inject({ method: 'POST', url, headers: as(userId) });
    expect(second.statusCode).toBe(409);
    expect(second.json().error.code).toBe('JOB_NOT_CANCELLABLE');
  });

  it('retries only failed jobs', async () => {
    const created = await createJob({ ...as(userId), 'idempotency-key': crypto.randomUUID() });
    const { jobId } = created.json();
    const url = `/v1/jobs/${jobId}/retry`;

    const early = await app.inject({ method: 'POST', url, headers: as(userId) });
    expect(early.statusCode).toBe(409);
    expect(early.json().error.code).toBe('JOB_NOT_RETRYABLE');

    await store.markRunning(jobId);
    await store.fail(jobId, 1, 'BUILD_FAILED', 'We could not finish this.');
    queue.entries.clear();

    const retried = await app.inject({ method: 'POST', url, headers: as(userId) });
    expect(retried.statusCode).toBe(202);
    expect(retried.json()).toMatchObject({ status: 'queued', attemptCount: 0, error: null });
    expect(await queue.has(jobId, 1)).toBe(true);
  });

  it('streams job state as server-sent events and ends when the job settles', async () => {
    const created = await createJob({ ...as(userId), 'idempotency-key': crypto.randomUUID() });
    const { jobId, eventsUrl } = created.json();

    // The job finishes shortly after the stream opens. The stream's own polling picks it up.
    setTimeout(async () => {
      await store.markRunning(jobId);
      await store.setStep(jobId, 1, 'normalize', 50);
      await store.succeed(jobId, 1, {});
    }, 100);

    const response = await app.inject({ method: 'GET', url: eventsUrl, headers: as(userId) });
    expect(response.headers['content-type']).toContain('text/event-stream');

    const events = response.body
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
    const { jobId, eventsUrl } = created.json();
    await store.requestCancel(jobId, userId);
    const version = (await store.get(jobId))!.version;

    const response = await app.inject({
      method: 'GET',
      url: eventsUrl,
      headers: { ...as(userId), 'last-event-id': String(version) },
    });
    expect(response.body).not.toContain('event: job');
  });

  it('does not expose the diagnostic route unless it is enabled', async () => {
    const closed = await buildApp({
      store,
      queue,
      events: { subscribe: () => () => {} },
      verifyToken: async () => ({ userId }),
      appOrigin: 'http://localhost:3000',
      enableDiagnosticJobs: false,
    });
    const response = await closed.inject({
      method: 'POST',
      url: '/v1/diagnostic-jobs',
      headers: { ...as(userId), 'idempotency-key': crypto.randomUUID() },
    });
    expect(response.statusCode).toBe(404);
    await closed.close();
  });
});
