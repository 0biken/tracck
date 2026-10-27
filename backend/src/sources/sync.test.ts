import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { JobDispatcher } from '../core/job-dispatcher.service';
import type { JobContext } from '../jobs/runner';
import { repo } from '../test/fakes';
import { createTestApp, type TestApp } from '../test/harness';
import { SourceImportHandler } from './import.handlers';

// The profile repository is read on every sync; the tests care only about project repositories.
const PROFILE = 'toluadebayo/toluadebayo';

let ctx: TestApp;
let user: string;
let sourceId: string;

const key = () => crypto.randomUUID();
const get = (path: string) => ctx.http().get(path).set(ctx.as(user));
const post = (path: string) => ctx.http().post(path).set(ctx.as(user)).set('Idempotency-Key', key());

const projectReads = () => ctx.github.reads.filter((name) => name !== PROFILE);

/** A read the way resume generation or a refresh triggers it, with the GitHub reads recorded. */
const readsDuring = async (action: () => Promise<unknown>) => {
  ctx.github.reads.length = 0;
  await action();
  await ctx.drain();
  return projectReads();
};

const githubEvidence = async () =>
  Number((await ctx.db.query<{ n: number }>(`select count(*)::int as n from public.candidate_evidence where user_id = $1 and source_provider = 'github'`, [user])).rows[0].n);

/** Starts a sync the way a retry or a background job would, without the refresh that forces a full read. */
const syncUnforced = async () => {
  await ctx.app.get(JobDispatcher).dispatch({ userId: user, jobType: 'source_import', idempotencyKey: key(), input: { connectionId: sourceId } });
};

beforeAll(async () => {
  ctx = await createTestApp();
  user = await ctx.newUser('Syncing Person');
  ctx.github.repos = [
    repo('alpha', { pushedAt: '2026-08-01T00:00:00Z', description: 'Alpha service that keeps payment ledgers in Postgres.' }),
    repo('beta', { pushedAt: '2026-08-02T00:00:00Z', description: 'Beta tool that queues webhooks through Redis locks.' }),
  ];
  ctx.github.readmes.set('toluadebayo/alpha', 'Alpha ledger service with double-entry tables and reconciliation jobs.');
  ctx.github.readmes.set('toluadebayo/beta', 'Beta webhook queue with idempotent delivery and retry backoff.');

  const state = new URL((await post('/v1/sources/github/connect').send({ from: 'sources' })).body.authorizeUrl).searchParams.get('state')!;
  await ctx.http().get('/v1/sources/github/callback').query({ code: 'good-code', state }).redirects(0);
  sourceId = (await get('/v1/sources')).body[0].id;
});

afterAll(() => ctx.close());

describe('reading a source', () => {
  it('reads every repository the first time', async () => {
    const reads = await readsDuring(async () => undefined);
    expect(reads).toEqual(['toluadebayo/alpha', 'toluadebayo/beta']);
    expect(await githubEvidence()).toBeGreaterThan(0);
  });

  it('does not read repositories that have not changed since the last read', async () => {
    const before = await githubEvidence();
    await syncUnforced();
    expect(await readsDuring(async () => undefined)).toEqual([]);
    expect(await githubEvidence()).toBe(before);
  });

  it('reads only the repository GitHub reports as pushed since', async () => {
    ctx.github.repos[0] = { ...ctx.github.repos[0], pushedAt: '2026-10-20T00:00:00Z' };
    await syncUnforced();
    expect(await readsDuring(async () => undefined)).toEqual(['toluadebayo/alpha']);
  });

  it('reads everything again when refreshed', async () => {
    const reads = await readsDuring(async () => {
      const response = await post(`/v1/sources/${sourceId}/refresh`);
      expect(response.status).toBe(202);
    });
    expect(reads).toEqual(['toluadebayo/alpha', 'toluadebayo/beta']);
  });

  it('is read before a resume only when it is more than six hours old', async () => {
    const jobContext = { job: { id: key(), userId: user, inputRef: {}, attemptCount: 1, maxAttempts: 3 }, setStep: async () => undefined } as unknown as JobContext;
    const handler = ctx.app.get(SourceImportHandler);

    await ctx.db.query(`update public.source_connections set last_sync_at = now() where id = $1`, [sourceId]);
    expect(await handler.syncChanged(user, jobContext)).toBe(0);

    await ctx.db.query(`update public.source_connections set last_sync_at = now() - interval '7 hours' where id = $1`, [sourceId]);
    ctx.github.reads.length = 0;
    expect(await handler.syncChanged(user, jobContext)).toBe(1);
    expect(projectReads()).toEqual([]);
  });
});

describe('resetting a source', () => {
  it('clears everything imported from the source, pinned entries included, and keeps the connection', async () => {
    await ctx.db.query(
      `update public.candidate_evidence set pinned = true
        where user_id = $1 and id = (select id from public.candidate_evidence where user_id = $1 and source_provider = 'github' limit 1)`,
      [user],
    );
    expect(await githubEvidence()).toBeGreaterThan(0);

    const response = await post(`/v1/sources/${sourceId}/reset`);
    expect(response.status).toBe(204);

    expect(await githubEvidence()).toBe(0);
    const [source] = (await get('/v1/sources')).body;
    expect(source).toMatchObject({ id: sourceId, provider: 'github', state: 'ready', entries: 0, lastCollectedAt: null });
    const { rows } = await ctx.db.query<{ n: number }>(`select count(*)::int as n from public.source_items where connection_id = $1`, [sourceId]);
    expect(rows[0].n).toBe(0);
  });

  it('keeps the connection usable: a refresh reads the source again', async () => {
    const reads = await readsDuring(async () => {
      expect((await post(`/v1/sources/${sourceId}/refresh`)).status).toBe(202);
    });
    expect(reads).toEqual(['toluadebayo/alpha', 'toluadebayo/beta']);
    expect(await githubEvidence()).toBeGreaterThan(0);
  });

  it('is only for the person who owns the source', async () => {
    const other = await ctx.newUser('Someone Else');
    const response = await ctx.http().post(`/v1/sources/${sourceId}/reset`).set(ctx.as(other)).set('Idempotency-Key', key());
    expect(response.status).toBe(404);
  });
});
