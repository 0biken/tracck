import type { PGlite } from './testing';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { JobError, JobStore, QUEUE_SCHEMA_VERSION, type JobRecord, type QueueMessage } from '@tracck/shared';
import { FakeJobQueue, createTestDatabase, createTestUser } from './testing';
import { reconcile } from './reconciler';
import { runJob, type JobHandler, type RunnerDeps } from './runner';

let db: PGlite;
let store: JobStore;
let userId: string;
let queue: FakeJobQueue;
let notified: string[];

beforeAll(async () => {
  db = await createTestDatabase();
  store = new JobStore(db);
  userId = await createTestUser(db);
});

beforeEach(() => {
  queue = new FakeJobQueue();
  notified = [];
});

const newJob = async (maxAttempts = 3) =>
  (await store.create({ userId, jobType: 'diagnostic', idempotencyKey: crypto.randomUUID(), maxAttempts })).job;

const messageFor = (job: JobRecord): QueueMessage => ({
  jobId: job.id,
  userId: job.userId,
  type: job.jobType,
  schemaVersion: QUEUE_SCHEMA_VERSION,
});

const deps = (handler?: JobHandler): RunnerDeps => ({
  store,
  queue,
  handlers: handler ? { diagnostic: handler } : {},
  notify: async (jobId) => {
    notified.push(jobId);
  },
  backoff: () => 1_000,
});

describe('runJob', () => {
  it('runs a job to success and persists each step', async () => {
    const job = await newJob();
    const seen: (string | null)[] = [];
    const outcome = await runJob(
      deps(async ({ setStep }) => {
        await setStep('normalize', 50);
        seen.push((await store.get(job.id))!.step);
        return { entries: 3 };
      }),
      messageFor(job),
    );

    expect(outcome).toBe('succeeded');
    expect(seen).toEqual(['normalize']);
    expect(await store.get(job.id)).toMatchObject({
      status: 'succeeded',
      attemptCount: 1,
      resultRef: { entries: 3 },
    });
    expect(notified.length).toBeGreaterThanOrEqual(2);
  });

  it('drops a duplicate delivery without running the handler again', async () => {
    const job = await newJob();
    let runs = 0;
    const handler: JobHandler = async () => {
      runs += 1;
      return {};
    };
    expect(await runJob(deps(handler), messageFor(job))).toBe('succeeded');
    expect(await runJob(deps(handler), messageFor(job))).toBe('skipped');
    expect(runs).toBe(1);
  });

  it('schedules a retry for a temporary failure, honoring Retry-After', async () => {
    const job = await newJob();
    const outcome = await runJob(
      deps(async () => {
        throw new JobError('retryable', 'IMPORT_RATE_LIMITED', 'The provider is limiting requests.', 30_000);
      }),
      messageFor(job),
    );

    expect(outcome).toBe('retry_scheduled');
    expect(await store.get(job.id)).toMatchObject({ status: 'retry_wait', errorCode: 'IMPORT_RATE_LIMITED' });
    expect([...queue.entries.values()]).toEqual([
      expect.objectContaining({ attempt: 2, delayMs: 30_000 }),
    ]);
  });

  it('fails for good once attempts run out', async () => {
    const job = await newJob(2);
    const handler: JobHandler = async () => {
      throw new JobError('retryable', 'UPSTREAM_DOWN', 'The provider is unavailable.');
    };
    expect(await runJob(deps(handler), messageFor(job))).toBe('retry_scheduled');
    expect(await runJob(deps(handler), messageFor(job))).toBe('failed');
    expect(await store.get(job.id)).toMatchObject({ status: 'failed', attemptCount: 2 });
  });

  it('does not retry a permanent failure', async () => {
    const job = await newJob();
    const outcome = await runJob(
      deps(async () => {
        throw new JobError('permanent', 'UNSUPPORTED_FILE_TYPE', 'We cannot read that file type.');
      }),
      messageFor(job),
    );
    expect(outcome).toBe('failed');
    expect(queue.entries.size).toBe(0);
  });

  it('stores only a safe message when a handler throws something unexpected', async () => {
    const job = await newJob();
    await runJob(
      deps(async () => {
        throw new Error('token=secret-value leaked from provider');
      }),
      messageFor(job),
    );
    const stored = await store.get(job.id);
    expect(stored).toMatchObject({ status: 'retry_wait', errorCode: 'INTERNAL_ERROR' });
    expect(stored!.safeErrorMessage).not.toContain('secret-value');
  });

  it('waits for the user when a handler needs their action', async () => {
    const job = await newJob();
    const outcome = await runJob(
      deps(async () => {
        throw new JobError('needs_user_action', 'SOURCE_REAUTH_REQUIRED', 'Reconnect this account to continue.');
      }),
      messageFor(job),
    );
    expect(outcome).toBe('needs_user_action');
    expect((await store.get(job.id))!.status).toBe('needs_user_action');
  });

  it('stops between steps when the user cancels', async () => {
    const job = await newJob();
    let reachedSecondStep = false;
    const outcome = await runJob(
      deps(async ({ setStep }) => {
        await setStep('download_source');
        await store.requestCancel(job.id, userId);
        await setStep('normalize');
        reachedSecondStep = true;
        return {};
      }),
      messageFor(job),
    );
    expect(outcome).toBe('cancelled');
    expect(reachedSecondStep).toBe(false);
    expect((await store.get(job.id))!.status).toBe('cancelled');
  });

  it('fails a job type that has no handler', async () => {
    const job = await newJob();
    expect(await runJob(deps(), messageFor(job))).toBe('failed');
    expect((await store.get(job.id))!.errorCode).toBe('UNSUPPORTED_JOB_TYPE');
  });

  it('keeps the job in retry_wait when the retry cannot be enqueued', async () => {
    const job = await newJob();
    queue.failNextEnqueue = true;
    const outcome = await runJob(
      deps(async () => {
        throw new JobError('retryable', 'UPSTREAM_DOWN', 'The provider is unavailable.');
      }),
      messageFor(job),
    );
    expect(outcome).toBe('retry_scheduled');
    expect(await store.get(job.id)).toMatchObject({ status: 'retry_wait' });
    expect((await store.get(job.id))!.enqueueError).toContain('Redis is unavailable');
  });
});

describe('reconcile', () => {
  const age = (jobId: string, column: 'updated_at' | 'heartbeat_at') =>
    db.query(`update background_jobs set ${column} = now() - interval '10 minutes' where id = $1`, [jobId]);

  it('re-enqueues a waiting job that Redis lost, and only once', async () => {
    const job = await newJob();
    await age(job.id, 'updated_at');

    expect((await reconcile({ store, queue, notify: async () => {} })).requeued).toBeGreaterThanOrEqual(1);
    expect(await queue.has(job.id, 1)).toBe(true);

    const before = queue.entries.size;
    await reconcile({ store, queue, notify: async () => {} });
    expect(queue.entries.size).toBe(before);
  });

  it('takes back a job whose worker died and queues the next attempt', async () => {
    const job = await newJob();
    await store.markRunning(job.id);
    await age(job.id, 'heartbeat_at');

    const result = await reconcile({ store, queue, notify: async () => {} });
    expect(result.recovered).toBeGreaterThanOrEqual(1);
    expect((await store.get(job.id))!.status).toBe('retry_wait');
    expect(await queue.has(job.id, 2)).toBe(true);
  });
});
