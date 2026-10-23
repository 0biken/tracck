import type { PGlite } from '../testing';
import { beforeAll, describe, expect, it } from 'vitest';
import { JobStore } from '@tracck/shared';
import { asBrowserUser, createTestDatabase, createTestUser } from '../testing';

let db: PGlite;
let store: JobStore;
let userId: string;
let otherUserId: string;

beforeAll(async () => {
  db = await createTestDatabase();
  store = new JobStore(db);
  userId = await createTestUser(db, 'Ada Example');
  otherUserId = await createTestUser(db);
});

const newJob = async (maxAttempts = 3) =>
  (await store.create({ userId, jobType: 'diagnostic', idempotencyKey: crypto.randomUUID(), maxAttempts })).job;

describe('schema', () => {
  it('creates a profile from the signup name', async () => {
    const { rows } = await db.query(`select display_name from profiles where id = $1`, [userId]);
    expect(rows).toEqual([{ display_name: 'Ada Example' }]);
  });

  it('lets a signed-in browser read only its own jobs, and write nothing', async () => {
    const mine = await newJob();
    const theirs = (
      await store.create({ userId: otherUserId, jobType: 'diagnostic', idempotencyKey: crypto.randomUUID() })
    ).job;

    await asBrowserUser(db, userId, async () => {
      const { rows } = await db.query<{ id: string }>(`select id from background_jobs`);
      const ids = rows.map((row) => row.id);
      expect(ids).toContain(mine.id);
      expect(ids).not.toContain(theirs.id);

      const update = await db.query(`update background_jobs set status = 'succeeded' where id = $1 returning id`, [
        mine.id,
      ]);
      expect(update.rows).toEqual([]);
      await expect(
        db.query(`insert into background_jobs (user_id, job_type, idempotency_key) values ($1, 'diagnostic', 'x')`, [
          userId,
        ]),
      ).rejects.toThrow(/row-level security/);
    });
  });

  it('never lets a browser read provider tokens', async () => {
    await asBrowserUser(db, userId, async () => {
      await expect(db.query(`select * from source_connection_secrets`)).rejects.toThrow(/permission denied/);
    });
  });
});

describe('JobStore', () => {
  it('scopes idempotency keys to the user', async () => {
    const idempotencyKey = crypto.randomUUID();
    const mine = await store.create({ userId, jobType: 'diagnostic', idempotencyKey });
    const theirs = await store.create({ userId: otherUserId, jobType: 'diagnostic', idempotencyKey });
    expect(theirs.created).toBe(true);
    expect(theirs.job.id).not.toBe(mine.job.id);
  });

  it('ignores updates from an attempt that was replaced', async () => {
    const job = await newJob();
    await store.markRunning(job.id);
    await store.scheduleRetry(job.id, 1, 'TEMPORARY', 'Temporary problem.');
    await store.markRunning(job.id);

    expect(await store.succeed(job.id, 1, {})).toBeNull();
    expect(await store.setStep(job.id, 1, 'normalize', 10)).toBeNull();
    expect(await store.succeed(job.id, 2, { ok: true })).toMatchObject({
      status: 'succeeded',
      progressPercent: 100,
      resultRef: { ok: true },
    });
  });

  it('only flags a running job for cancellation', async () => {
    const job = await newJob();
    await store.markRunning(job.id);
    const flagged = await store.requestCancel(job.id, userId);
    expect(flagged).toMatchObject({ status: 'running' });
    expect(flagged!.cancelRequestedAt).not.toBeNull();
    expect(await store.cancelRunning(job.id, 1)).toMatchObject({ status: 'cancelled' });
  });

  it('refuses to cancel a settled job or someone else’s job', async () => {
    const job = await newJob();
    expect(await store.requestCancel(job.id, otherUserId)).toBeNull();
    await store.markRunning(job.id);
    await store.succeed(job.id, 1, {});
    expect(await store.requestCancel(job.id, userId)).toBeNull();
  });

  it('recovers a running job whose worker went silent', async () => {
    const retryable = await newJob(3);
    const exhausted = await newJob(1);
    for (const job of [retryable, exhausted]) {
      await store.markRunning(job.id);
      await db.query(`update background_jobs set heartbeat_at = now() - interval '10 minutes' where id = $1`, [
        job.id,
      ]);
    }

    const stale = await store.findStaleRunning(60, 100);
    expect(stale.map((job) => job.id)).toEqual(expect.arrayContaining([retryable.id, exhausted.id]));

    expect(await store.recoverStaleRunning(retryable.id, 60)).toMatchObject({
      status: 'retry_wait',
      errorCode: 'WORKER_LOST',
    });
    expect(await store.recoverStaleRunning(exhausted.id, 60)).toMatchObject({ status: 'failed' });
  });

  it('leaves a running job alone while its heartbeat is fresh', async () => {
    const job = await newJob();
    await store.markRunning(job.id);
    expect(await store.recoverStaleRunning(job.id, 60)).toBeNull();
  });
});
