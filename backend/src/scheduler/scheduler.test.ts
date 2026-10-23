import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SchedulerService } from './scheduler.service';
import { createTestApp, type TestApp } from '../test/harness';

let ctx: TestApp;
let scheduler: SchedulerService;

// 2026-10-19 is a Monday.
const at = (iso: string) => new Date(iso);
const jobs = async (type: string) =>
  (await ctx.db.query<{ user_id: string; idempotency_key: string }>(`select user_id, idempotency_key from public.background_jobs where job_type = $1`, [type])).rows;

const connect = async (user: string, provider: string, status: string, lastSync: string | null) =>
  (
    await ctx.db.query<{ id: string }>(
      `insert into public.source_connections (user_id, provider, display_handle, status, last_sync_at, consent_version) values ($1, $2, '@someone', $3, $4, 'v1') returning id`,
      [user, provider, status, lastSync],
    )
  ).rows[0].id;

beforeAll(async () => {
  ctx = await createTestApp({ email: true });
  scheduler = ctx.app.get(SchedulerService);
});

afterAll(() => ctx.close());

describe('refreshing sources', () => {
  let user: string;
  let github: string;

  beforeAll(async () => {
    user = await ctx.newUser('Refresher');
    github = await connect(user, 'github', 'synced', '2026-10-19T06:30:00Z');
    await connect(user, 'cv', 'synced', '2026-09-01T00:00:00Z');
    await connect(user, 'portfolio', 'needs_reauth', '2026-09-01T00:00:00Z');
  });

  it('waits until the morning refresh time', async () => {
    expect(await scheduler.refreshSources(at('2026-10-20T05:59:00Z'))).toBe(0);
    expect(await jobs('source_sync')).toHaveLength(0);
  });

  it('queues a read for each GitHub or portfolio source not read today, and no other', async () => {
    expect(await scheduler.refreshSources(at('2026-10-20T06:05:00Z'))).toBe(1);
    expect(await jobs('source_sync')).toEqual([{ user_id: user, idempotency_key: `sync:${github}:2026-10-20` }]);
    expect((await ctx.db.query<{ status: string }>(`select status from public.source_connections where id = $1`, [github])).rows[0].status).toBe('sync_queued');
  });

  it('does it once a day however often the clock ticks', async () => {
    expect(await scheduler.refreshSources(at('2026-10-20T06:10:00Z'))).toBe(0);
    expect(await scheduler.refreshSources(at('2026-10-20T18:00:00Z'))).toBe(0);
    expect(await jobs('source_sync')).toHaveLength(1);
  });

  it('leaves a source that was already read this morning', async () => {
    const fresh = await ctx.newUser('Fresh');
    await connect(fresh, 'github', 'synced', '2026-10-21T06:20:00Z');
    expect(await scheduler.refreshSources(at('2026-10-21T08:00:00Z'))).toBe(0);
    expect((await jobs('source_sync')).filter((job) => job.user_id === fresh)).toHaveLength(0);
  });
});

describe('the weekly digest', () => {
  let active: string;
  let quiet: string;
  let idle: string;

  beforeAll(async () => {
    active = await ctx.newUser('Active');
    quiet = await ctx.newUser('Quiet');
    idle = await ctx.newUser('Idle');
    for (const user of [active, quiet]) {
      await ctx.db.query(`insert into public.candidate_evidence (user_id, evidence_type, claim_text, content_hash, created_at) values ($1, 'achievement', 'Shipped a thing this week', $2, '2026-10-17T10:00:00Z')`, [user, `h-${user}`]);
    }
    await ctx.db.query(`insert into public.candidate_evidence (user_id, evidence_type, claim_text, content_hash, created_at) values ($1, 'achievement', 'An old thing from long ago', $2, '2026-08-01T10:00:00Z')`, [idle, `old-${idle}`]);
    await ctx.db.query(`update public.profiles set preferences_json = $2::jsonb where id = $1`, [quiet, JSON.stringify({ notifications: { done: true, weekly: false, attention: true } })]);
  });

  it('goes out on Monday mornings only', async () => {
    expect(await scheduler.sendDigests(at('2026-10-20T08:00:00Z'))).toBe(0);
    expect(await scheduler.sendDigests(at('2026-10-19T06:00:00Z'))).toBe(0);
  });

  it('goes to people with something new who have not turned it off, once a week', async () => {
    expect(await scheduler.sendDigests(at('2026-10-19T08:00:00Z'))).toBe(1);
    expect(await scheduler.sendDigests(at('2026-10-19T12:00:00Z'))).toBe(1);
    expect((await jobs('weekly_digest')).map((job) => job.user_id)).toEqual([active]);

    await ctx.drain();
    const { rows } = await ctx.db.query<{ payload_json: { entries: number } }>(`select payload_json from public.notifications where user_id = $1 and template = 'weekly_digest'`, [active]);
    expect(rows).toHaveLength(1);
    expect(rows[0].payload_json.entries).toBe(1);
    expect(ctx.email.sent.some((mail) => mail.subject === '1 new entry in your record')).toBe(true);
  });
});

describe('cleaning up', () => {
  let user: string;
  let keeper: string;

  const cvItem = async (owner: string, months: number, name: string) => {
    const connection = (
      await ctx.db.query<{ id: string }>(`insert into public.source_connections (user_id, provider, status, consent_version) values ($1, 'cv', 'synced', 'v1') returning id`, [owner])
    ).rows[0].id;
    const objectKey = `users/${owner}/${connection}/${name}`;
    await ctx.storage.put(objectKey, Buffer.from('pdf'), 'application/pdf');
    await ctx.db.query(
      `insert into public.source_items (user_id, connection_id, source_type, title, body_text, raw_object_key, imported_at)
       values ($1, $2, 'uploaded_cv', $3, 'Old CV text that is long enough to count', $4, now() - ($5 || ' months')::interval)`,
      [owner, connection, name, objectKey, String(months)],
    );
    return objectKey;
  };

  beforeAll(async () => {
    user = await ctx.newUser('Retention');
    keeper = await ctx.newUser('Keeper');
    await ctx.db.query(`update public.profiles set preferences_json = '{"cvRetention":"until_deleted"}'::jsonb where id = $1`, [keeper]);
  });

  it('waits until the small hours have passed', async () => {
    expect(await scheduler.cleanup(new Date('2026-10-21T02:00:00Z'))).toBeNull();
  });

  it('removes CV files and text past the person’s retention, and keeps the rest', async () => {
    const old = await cvItem(user, 13, 'old.pdf');
    const recent = await cvItem(user, 2, 'recent.pdf');
    const kept = await cvItem(keeper, 40, 'kept.pdf');

    const now = new Date();
    now.setUTCHours(5, 0, 0, 0);
    const result = await scheduler.cleanup(now);
    expect(result).toMatchObject({ cvFiles: 1 });

    expect(ctx.storage.objects.has(old)).toBe(false);
    expect(ctx.storage.objects.has(recent)).toBe(true);
    expect(ctx.storage.objects.has(kept)).toBe(true);
    const { rows } = await ctx.db.query<{ title: string; raw_object_key: string | null; body_text: string | null }>(`select title, raw_object_key, body_text from public.source_items where user_id = $1 order by title`, [user]);
    expect(rows).toEqual([
      { title: 'old.pdf', raw_object_key: null, body_text: null },
      { title: 'recent.pdf', raw_object_key: recent, body_text: 'Old CV text that is long enough to count' },
    ]);
  });

  it('runs once a day however many instances tick', async () => {
    const now = new Date();
    now.setUTCHours(9, 0, 0, 0);
    expect(await scheduler.cleanup(now)).toBeNull();
    const tomorrow = new Date(now.getTime() + 86_400_000);
    expect(await scheduler.cleanup(tomorrow)).not.toBeNull();
  });

  it('expires consent requests nobody answered', async () => {
    const client = (await ctx.db.query<{ id: string }>(`insert into public.api_clients (name, status) values ('Acme', 'active') returning id`)).rows[0].id;
    await ctx.db.query(`insert into public.consent_requests (client_id, token_hash, scopes, expires_at) values ($1, 'hash-1', '{profile:read}', now() - interval '1 day')`, [client]);
    const day = new Date(Date.now() + 3 * 86_400_000);
    day.setUTCHours(5, 0, 0, 0);
    expect(await scheduler.cleanup(day)).toMatchObject({ consentRequests: 1 });
  });
});
