import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from '../test/harness';
import { signWebhook } from './webhook.handler';

const STAFF = '00000000-0000-4000-8000-0000000000aa';
const JOB = `Backend Engineer
We need someone strong in TypeScript and PostgreSQL to build payment services.
Nice to have: Docker experience.`;

let ctx: TestApp;
let student: string;
let stranger: string;
let clientId: string;
let live: { id: string; secret: string };

const key = () => crypto.randomUUID();
const staff = (method: 'get' | 'post' | 'patch' | 'delete', path: string, body?: object) => ctx.http()[method](path).set(ctx.as(STAFF)).send(body);
const org = (method: 'get' | 'post', path: string, secret: string, body?: object, idempotency = key()) =>
  ctx.http()[method](path).set('Authorization', `Bearer ${secret}`).set('Idempotency-Key', idempotency).send(body);
const row = async <T>(query: string, params: unknown[] = []) => (await ctx.db.query<T>(query, params)).rows[0];

const makeKey = async (client: string, body: object = {}) => {
  const created = await staff('post', `/v1/admin/clients/${client}/keys`, { label: 'Server', mode: 'live', scopes: ['generate:resume', 'read:resume', 'read:profile'], ...body });
  expect(created.status).toBe(201);
  return { id: created.body.key.id as string, secret: created.body.secret as string };
};

/** The student opens the organisation's link and agrees to the scopes asked for. */
const consentTo = async (user: string, secret: string, scopes: string[], externalRef = 'learner-1') => {
  const link = await org('post', '/v1/org/consent-links', secret, { scopes, externalRef });
  const token = link.body.url.split('/consent/')[1] as string;
  await ctx.http().post(`/v1/consent-requests/${token}/grant`).set(ctx.as(user)).send({ scopes });
  return token;
};

beforeAll(async () => {
  ctx = await createTestApp({ env: { STAFF_USER_IDS: STAFF }, email: false });
  await ctx.db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'staff@tracck.test', '{"full_name":"Staff Person"}'::jsonb)`, [STAFF]);
  student = await ctx.newUser('Ada Student');
  stranger = await ctx.newUser('Stranger');

  // The student has a record and has agreed to the terms, so a resume can be written for them.
  await ctx.http().post('/v1/me/consents/policy').set(ctx.as(student));
  await ctx.db.query(`update public.profiles set headline = 'Final-year CS student', location = 'Lagos', preferred_roles = '{dev}' where id = $1`, [student]);
  const rows: [string, string[]][] = [
    ['Built the payments API in TypeScript and PostgreSQL, handling 40000 transactions a day.', ['TypeScript', 'PostgreSQL']],
    ['Containerised the services with Docker and cut deploy time from 20 minutes to 4.', ['Docker']],
  ];
  for (const [index, [text, skills]] of rows.entries()) {
    await ctx.db.query(
      `insert into public.candidate_evidence (user_id, evidence_type, claim_text, skills, source_provider, content_hash) values ($1, 'achievement', $2, $3, 'cv', $4)`,
      [student, text, skills, `org-${index}`],
    );
  }

  const client = await staff('post', '/v1/admin/clients', { name: 'Unilag Careers', contactEmail: 'careers@unilag.edu.ng', monthlyQuota: 50 });
  clientId = client.body.id;
  live = await makeKey(clientId, { label: 'Production', rateLimitPerMin: 100 });
});

afterAll(() => ctx.close());

describe('the staff console', () => {
  it('is for staff only', async () => {
    expect((await ctx.http().get('/v1/admin/clients')).status).toBe(401);
    const refused = await ctx.http().get('/v1/admin/clients').set(ctx.as(student));
    expect(refused.status).toBe(403);
    expect(refused.body.error.code).toBe('FORBIDDEN');
    expect((await ctx.http().get('/v1/me').set(ctx.as(STAFF))).body.staff).toBe(true);
    expect((await ctx.http().get('/v1/me').set(ctx.as(student))).body.staff).toBe(false);
  });

  it('lists the organisations it has set up', async () => {
    const { body } = await staff('get', '/v1/admin/clients');
    expect(body).toEqual([expect.objectContaining({ id: clientId, name: 'Unilag Careers', status: 'active', contactEmail: 'careers@unilag.edu.ng', monthlyQuota: 50 })]);
    expect((await staff('post', '/v1/admin/clients', { name: 'x' })).status).toBe(400);
  });

  it('shows a key’s secret once, and keeps only a hash', async () => {
    expect(live.secret).toMatch(/^trk_live_[0-9a-f]{8}_[A-Za-z0-9_-]{43}$/);
    const { body } = await staff('get', `/v1/admin/clients/${clientId}/keys`);
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ label: 'Production', mode: 'live', state: 'active', rateLimitPerMin: 100, scopes: ['generate:resume', 'read:resume', 'read:profile'], lastUsedAt: null });
    expect(JSON.stringify(body)).not.toContain(live.secret.split('_').at(-1));
    expect(body[0].display).toMatch(/^trk_live_[0-9a-f]{8}…$/);

    const stored = await row<{ secret_hash: string }>(`select secret_hash from public.api_keys where id = $1`, [live.id]);
    expect(stored.secret_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(live.secret).not.toContain(stored.secret_hash);
  });

  it('checks what a key is asked to do', async () => {
    for (const body of [{ scopes: [] }, { scopes: ['delete:everything'] }, { mode: 'staging' }, { label: '' }, { rateLimitPerMin: 0 }]) {
      expect((await staff('post', `/v1/admin/clients/${clientId}/keys`, { label: 'K', mode: 'live', scopes: ['read:profile'], ...body })).status).toBe(400);
    }
    expect((await staff('get', `/v1/admin/clients/${key()}/keys`)).status).toBe(404);
  });

  it('keeps a suspended organisation from getting keys and from calling the API', async () => {
    const other = (await staff('post', '/v1/admin/clients', { name: 'Paused Org' })).body.id;
    const k = await makeKey(other);
    await staff('patch', `/v1/admin/clients/${other}`, { status: 'suspended' });
    expect((await staff('post', `/v1/admin/clients/${other}/keys`, { label: 'K', mode: 'live', scopes: ['read:profile'] })).status).toBe(409);
    const refused = await org('get', '/v1/org/usage', k.secret);
    expect(refused.status).toBe(403);
    await staff('patch', `/v1/admin/clients/${other}`, { status: 'active' });
    expect((await org('get', '/v1/org/usage', k.secret)).status).toBe(200);
  });
});

describe('calling the API', () => {
  it('needs a real key, and says the same thing for every kind of wrong key', async () => {
    const none = await ctx.http().get('/v1/org/usage');
    expect(none.status).toBe(401);
    const prefix = live.secret.slice(0, 17);
    const messages = new Set<string>();
    for (const token of ['not-a-key', `${prefix}_${'a'.repeat(43)}`, `trk_live_00000000_${'a'.repeat(43)}`, live.secret.replace('trk_live', 'trk_test')]) {
      const response = await ctx.http().get('/v1/org/usage').set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(401);
      messages.add(response.body.error.message);
    }
    expect(messages.size).toBeLessThanOrEqual(2); // malformed, or not valid
    expect((await ctx.http().get('/v1/org/usage').set('Authorization', `Bearer ${live.secret}`)).status).toBe(200);
  });

  it('sends rate limit headers and remembers when the key was last used', async () => {
    const response = await org('get', '/v1/org/usage', live.secret);
    expect(response.headers['x-ratelimit-limit']).toBe('100');
    expect(Number(response.headers['x-ratelimit-remaining'])).toBeLessThan(100);
    const { body } = await staff('get', `/v1/admin/clients/${clientId}/keys`);
    expect(body[0].lastUsedAt).not.toBeNull();
  });

  it('refuses a key that lacks the scope, naming the scope', async () => {
    const narrow = await makeKey(clientId, { label: 'Read only', scopes: ['read:profile'] });
    const refused = await org('post', `/v1/org/users/${student}/resumes`, narrow.secret, { jobDescription: JOB, length: 'one_page' });
    expect(refused.status).toBe(403);
    expect(refused.body.error.message).toContain('generate:resume');
    expect((await org('get', `/v1/org/jobs/${key()}`, narrow.secret)).status).toBe(403);
  });

  it('limits how fast a key may call, and says when to try again', async () => {
    const slow = await makeKey(clientId, { label: 'Slow', rateLimitPerMin: 3, scopes: ['read:profile'] });
    for (let i = 0; i < 3; i++) expect((await org('get', '/v1/org/usage', slow.secret)).status).toBe(200);
    const limited = await org('get', '/v1/org/usage', slow.secret);
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('RATE_LIMITED');
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
    expect(Number(limited.headers['retry-after'])).toBeLessThanOrEqual(60);
    const usage = await org('get', '/v1/org/usage', live.secret);
    expect(usage.body.rateLimited).toBeGreaterThanOrEqual(1);
  });
});

describe('asking a person for access', () => {
  let token: string;

  it('only lets a key ask for what it may itself use', async () => {
    const narrow = await makeKey(clientId, { label: 'Profile only', scopes: ['read:profile'] });
    const refused = await org('post', '/v1/org/consent-links', narrow.secret, { scopes: ['generate:resume'] });
    expect(refused.status).toBe(403);
    expect((await org('post', '/v1/org/consent-links', live.secret, { scopes: [] })).status).toBe(400);
  });

  it('makes a link the person can open without signing in, showing who asks and for what', async () => {
    const link = await org('post', '/v1/org/consent-links', live.secret, { scopes: ['read:profile', 'generate:resume'], externalRef: 'matric-2024-001' });
    expect(link.status).toBe(201);
    expect(link.body.url).toMatch(/^http:\/\/localhost:3000\/consent\/[A-Za-z0-9_-]{40,}$/);
    expect(new Date(link.body.expiresAt).getTime()).toBeGreaterThan(Date.now() + 6 * 86_400_000);
    token = link.body.url.split('/consent/')[1];

    const view = await ctx.http().get(`/v1/consent-requests/${token}`);
    expect(view.status).toBe(200);
    expect(view.body).toMatchObject({
      orgName: 'Unilag Careers',
      status: 'pending',
      scopes: [
        { id: 'read:profile', label: 'Read your profile and skills summary' },
        { id: 'generate:resume', label: 'Generate resumes for jobs' },
      ],
    });
    expect((await ctx.http().get('/v1/consent-requests/a-token-that-does-not-exist-1234')).status).toBe(404);
    expect((await ctx.http().get('/v1/consent-requests/short')).status).toBe(400);
  });

  it('shares nothing until the person says yes, and then only what they chose', async () => {
    expect((await org('get', `/v1/org/users/${student}/profile`, live.secret)).status).toBe(404);
    expect((await ctx.http().post(`/v1/consent-requests/${token}/grant`).send({ scopes: ['read:profile'] })).status).toBe(401);
    expect((await ctx.http().post(`/v1/consent-requests/${token}/grant`).set(ctx.as(student)).send({ scopes: ['read:resume'] })).status).toBe(400);

    const granted = await ctx.http().post(`/v1/consent-requests/${token}/grant`).set(ctx.as(student)).send({ scopes: ['read:profile'] });
    expect(granted.status).toBe(200);
    expect((await ctx.http().get(`/v1/consent-requests/${token}`)).body.status).toBe('granted');
    expect((await ctx.http().post(`/v1/consent-requests/${token}/grant`).set(ctx.as(student)).send({ scopes: ['read:profile'] })).status).toBe(409);

    const consents = await ctx.http().get('/v1/me/consents').set(ctx.as(student));
    expect(consents.body.granted).toEqual([expect.objectContaining({ orgName: 'Unilag Careers', scopes: ['read:profile'] })]);
  });

  it('reads the profile the person allowed, and nothing they did not', async () => {
    const profile = await org('get', `/v1/org/users/${student}/profile`, live.secret);
    expect(profile.status).toBe(200);
    expect(profile.body).toMatchObject({ name: 'Ada Student', headline: 'Final-year CS student', location: 'Lagos', roles: ['dev'] });
    expect(profile.body.skills).toEqual(expect.arrayContaining(['TypeScript', 'PostgreSQL', 'Docker']));
    expect(Object.keys(profile.body).sort()).toEqual(['headline', 'location', 'name', 'roles', 'skills']);

    // Not granted for generating resumes, so asking to is the same as asking about a stranger.
    const refused = await org('post', `/v1/org/users/${student}/resumes`, live.secret, { jobDescription: JOB, length: 'one_page' });
    expect(refused.status).toBe(404);
  });

  it('looks the same for a person who never agreed as for one who does not exist', async () => {
    const unknown = await org('get', `/v1/org/users/${key()}/profile`, live.secret);
    const refused = await org('get', `/v1/org/users/${stranger}/profile`, live.secret);
    expect(unknown.status).toBe(404);
    expect(refused.status).toBe(404);
    expect(refused.body.error.message).toBe(unknown.body.error.message);
  });

  it('can be refused, once', async () => {
    const link = await org('post', '/v1/org/consent-links', live.secret, { scopes: ['read:profile'] });
    const other = link.body.url.split('/consent/')[1];
    expect((await ctx.http().post(`/v1/consent-requests/${other}/deny`).set(ctx.as(stranger))).status).toBe(200);
    expect((await ctx.http().get(`/v1/consent-requests/${other}`)).body.status).toBe('denied');
    expect((await ctx.http().post(`/v1/consent-requests/${other}/grant`).set(ctx.as(stranger)).send({ scopes: ['read:profile'] })).status).toBe(409);
    expect((await org('get', `/v1/org/users/${stranger}/profile`, live.secret)).status).toBe(404);
  });

  it('expires after a week', async () => {
    const link = await org('post', '/v1/org/consent-links', live.secret, { scopes: ['read:profile'] });
    const old = link.body.url.split('/consent/')[1];
    await ctx.db.query(`update public.consent_requests set expires_at = now() - interval '1 minute' where status = 'pending'`);
    expect((await ctx.http().get(`/v1/consent-requests/${old}`)).body.status).toBe('expired');
    expect((await ctx.http().post(`/v1/consent-requests/${old}/grant`).set(ctx.as(stranger)).send({ scopes: ['read:profile'] })).status).toBe(409);
  });

  it('stops the moment the person takes access back', async () => {
    expect((await org('get', `/v1/org/users/${student}/profile`, live.secret)).status).toBe(200);
    const revoke = await ctx.http().delete(`/v1/me/consents/${clientId}`).set(ctx.as(student));
    expect(revoke.status).toBe(204);
    expect((await org('get', `/v1/org/users/${student}/profile`, live.secret)).status).toBe(404);

    const audit = await staff('get', `/v1/admin/clients/${clientId}/audit`);
    expect(audit.body.map((event: { event: string }) => event.event)).toEqual(expect.arrayContaining(['consent.requested', 'consent.granted', 'consent.revoked']));
  });
});

describe('writing a resume for a person who agreed', () => {
  let jobId: string;
  let resumeId: string;
  const idempotency = key();

  beforeAll(async () => {
    await consentTo(student, live.secret, ['read:profile', 'generate:resume', 'read:resume'], 'matric-2024-001');
    await ctx.drain();
  });

  it('starts the job once however many times the request is repeated', async () => {
    const body = { jobDescription: JOB, length: 'one_page' };
    const first = await org('post', `/v1/org/users/${student}/resumes`, live.secret, body, idempotency);
    expect(first.status).toBe(202);
    expect(first.body.statusUrl).toBe(`/v1/org/jobs/${first.body.jobId}`);
    jobId = first.body.jobId;

    const again = await org('post', `/v1/org/users/${student}/resumes`, live.secret, body, idempotency);
    expect(again.body.jobId).toBe(jobId);
    expect((await ctx.http().post(`/v1/org/users/${student}/resumes`).set('Authorization', `Bearer ${live.secret}`).send(body)).status).toBe(400);
    expect((await org('post', `/v1/org/users/${student}/resumes`, live.secret, { jobDescription: 'short', length: 'one_page' })).status).toBe(400);
  });

  it('reports progress, then hands over the finished resume', async () => {
    const waiting = await org('get', `/v1/org/jobs/${jobId}`, live.secret);
    expect(waiting.body).toMatchObject({ id: jobId, status: 'queued', result: null, error: null });

    await ctx.drain();
    const done = await org('get', `/v1/org/jobs/${jobId}`, live.secret);
    expect(done.body.status).toBe('succeeded');
    resumeId = done.body.result.resumeId;
    expect(done.body.result.content.header.name).toBe('Ada Student');
    expect(done.body.result.content.sections.length).toBeGreaterThan(0);
    expect(typeof done.body.result.score).toBe('number');
  });

  it('keeps one organisation’s jobs from another', async () => {
    const rival = (await staff('post', '/v1/admin/clients', { name: 'Rival Org' })).body.id;
    const k = await makeKey(rival);
    expect((await org('get', `/v1/org/jobs/${jobId}`, k.secret)).status).toBe(404);
    expect((await org('get', '/v1/org/jobs/not-a-job', live.secret)).status).toBe(404);
  });

  it('puts the resume in the person’s own list, and not on their plan', async () => {
    const list = await ctx.http().get('/v1/resumes').set(ctx.as(student));
    expect(list.body.items.map((r: { id: string }) => r.id)).toContain(resumeId);
    const usage = await row<{ count: number }>(`select coalesce(sum(count), 0)::int as count from public.usage_counters where user_id = $1 and metric = 'resumes'`, [student]);
    expect(usage.count).toBe(0);
  });

  it('counts it once against the organisation’s quota, and shows it in usage', async () => {
    const usage = (await org('get', '/v1/org/usage', live.secret)).body;
    expect(usage).toMatchObject({ resumesGenerated: 1, quota: 50, studentsConsented: 1, client: { name: 'Unilag Careers' } });
    expect(usage.apiRequests).toBeGreaterThan(3);
    expect(usage.perDay.reduce((sum: number, n: number) => sum + n, 0)).toBe(1);
    expect(usage.quotaUsedPercent).toBe(2);
    const viaStaff = (await staff('get', `/v1/admin/clients/${clientId}/usage`)).body;
    expect(viaStaff.resumesGenerated).toBe(1);
  });

  it('refuses a person who has not set up their account', async () => {
    const fresh = await ctx.newUser('Fresh');
    await ctx.db.query(`insert into public.candidate_evidence (user_id, evidence_type, claim_text, content_hash) values ($1, 'achievement', 'Did a thing worth writing down', 'f')`, [fresh]);
    await consentTo(fresh, live.secret, ['generate:resume']);
    const refused = await org('post', `/v1/org/users/${fresh}/resumes`, live.secret, { jobDescription: JOB, length: 'one_page' });
    expect(refused.status).toBe(409);
  });
});

describe('the quota', () => {
  it('stops a key at its own limit, with a date for when it resets', async () => {
    const small = await makeKey(clientId, { label: 'Small', monthlyQuota: 1 });
    await org('post', `/v1/org/users/${student}/resumes`, small.secret, { jobDescription: JOB, length: 'one_page' });
    await ctx.drain();
    const refused = await org('post', `/v1/org/users/${student}/resumes`, small.secret, { jobDescription: `${JOB}\nSecond.`, length: 'one_page' });
    expect(refused.status).toBe(429);
    expect(refused.body.error.message).toMatch(/This key has used its monthly quota\. It resets on \d{4}-\d{2}-01/);
    expect(Number(refused.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('stops the whole organisation at its limit', async () => {
    const tiny = (await staff('post', '/v1/admin/clients', { name: 'Tiny Org', monthlyQuota: 1 })).body.id;
    const k = await makeKey(tiny);
    await consentTo(student, k.secret, ['generate:resume']);
    expect((await org('post', `/v1/org/users/${student}/resumes`, k.secret, { jobDescription: JOB, length: 'one_page' })).status).toBe(202);
    await ctx.drain();
    const refused = await org('post', `/v1/org/users/${student}/resumes`, k.secret, { jobDescription: `${JOB}\nAgain.`, length: 'one_page' });
    expect(refused.status).toBe(429);
    expect(refused.body.error.message).toContain('Your organisation has used its monthly quota');
  });
});

describe('webhooks', () => {
  let hookClient: string;
  let hookKey: { id: string; secret: string };
  let hookSecret: string;
  const url = 'https://hooks.unilag.edu.ng/tracck';

  beforeAll(async () => {
    hookClient = (await staff('post', '/v1/admin/clients', { name: 'Hooked Org' })).body.id;
    hookKey = await makeKey(hookClient);
    await consentTo(student, hookKey.secret, ['generate:resume', 'read:resume'], 'matric-777');
  });

  it('only sends to https addresses, and shows the signing secret once', async () => {
    expect((await staff('post', `/v1/admin/clients/${hookClient}/webhook`, { url: 'http://insecure.example/hook' })).status).toBe(400);
    const set = await staff('post', `/v1/admin/clients/${hookClient}/webhook`, { url });
    expect(set.status).toBe(200);
    hookSecret = set.body.secret;
    expect(hookSecret).toMatch(/^whsec_/);
    const stored = await row<{ webhook_secret_encrypted: string }>(`select webhook_secret_encrypted from public.api_clients where id = $1`, [hookClient]);
    expect(stored.webhook_secret_encrypted).not.toContain(hookSecret);
    expect(JSON.stringify((await staff('get', '/v1/admin/clients')).body)).not.toContain(hookSecret);
  });

  it('tells the organisation when the resume is ready, signed so they can check it came from Tracck', async () => {
    ctx.safeFetch.pages.set(url, { status: 200 });
    ctx.safeFetch.requests.length = 0;
    const started = await org('post', `/v1/org/users/${student}/resumes`, hookKey.secret, { jobDescription: JOB, length: 'one_page' });
    await ctx.drain();

    const sent = ctx.safeFetch.requests.filter((r) => r.url === url);
    expect(sent).toHaveLength(1);
    const { options } = sent[0];
    expect(options?.method).toBe('POST');
    const payload = JSON.parse(options!.body!);
    expect(payload).toMatchObject({ type: 'resume.completed', data: { jobId: started.body.jobId, status: 'succeeded', externalRef: 'matric-777' } });

    const header = options!.headers!['Tracck-Signature'];
    const [, timestamp, signature] = header.match(/^t=(\d+),v1=([0-9a-f]{64})$/)!;
    expect(signature).toBe(createHmac('sha256', hookSecret).update(`${timestamp}.${options!.body}`).digest('hex'));
    expect(header).toBe(signWebhook(hookSecret, Number(timestamp), options!.body!));
    expect(options!.headers!['Tracck-Event']).toBe('resume.completed');
  });

  it('tries again when the receiver is down, and stops when it refuses', async () => {
    ctx.safeFetch.requests.length = 0;
    ctx.safeFetch.pages.set(url, { status: 503 });
    await org('post', `/v1/org/users/${student}/resumes`, hookKey.secret, { jobDescription: `${JOB}\nRetry.`, length: 'one_page' });
    const outcomes = await ctx.drain();
    expect(outcomes.filter((o) => o === 'retry_scheduled').length).toBeGreaterThanOrEqual(1);
    expect(ctx.safeFetch.requests.filter((r) => r.url === url).length).toBeGreaterThanOrEqual(2);

    ctx.safeFetch.requests.length = 0;
    ctx.safeFetch.pages.set(url, { status: 400 });
    await org('post', `/v1/org/users/${student}/resumes`, hookKey.secret, { jobDescription: `${JOB}\nRefused.`, length: 'one_page' });
    const refused = await ctx.drain();
    expect(refused).toContain('failed');
    expect(ctx.safeFetch.requests.filter((r) => r.url === url)).toHaveLength(1);
  });

  it('does nothing for an organisation without a webhook', async () => {
    ctx.safeFetch.requests.length = 0;
    await org('post', `/v1/org/users/${student}/resumes`, live.secret, { jobDescription: `${JOB}\nNo hook.`, length: 'one_page' });
    await ctx.drain();
    expect(ctx.safeFetch.requests).toHaveLength(0);
  });
});

describe('key rotation and revocation', () => {
  let target: { id: string; secret: string };

  beforeAll(async () => {
    target = await makeKey(clientId, { label: 'Rotating', expiresInDays: 30 });
  });

  it('gives a new key with the same settings, and lets the old one run for a day', async () => {
    const rotated = await staff('post', `/v1/admin/clients/${clientId}/keys/${target.id}/rotate`);
    expect(rotated.status).toBe(200);
    expect(rotated.body.key).toMatchObject({ label: 'Rotating', mode: 'live', state: 'active' });
    expect(rotated.body.secret).not.toBe(target.secret);

    const keys = (await staff('get', `/v1/admin/clients/${clientId}/keys`)).body;
    const old = keys.find((k: { id: string }) => k.id === target.id);
    expect(old.state).toBe('rotating');
    expect(new Date(old.stopsAt).getTime() - Date.now()).toBeGreaterThan(23 * 3_600_000);

    expect((await org('get', '/v1/org/usage', target.secret)).status).toBe(200);
    expect((await org('get', '/v1/org/usage', rotated.body.secret)).status).toBe(200);
    expect((await staff('post', `/v1/admin/clients/${clientId}/keys/${target.id}/rotate`)).status).toBe(409);

    await ctx.db.query(`update public.api_keys set stops_at = now() - interval '1 minute' where id = $1`, [target.id]);
    expect((await org('get', '/v1/org/usage', target.secret)).status).toBe(401);
    expect((await org('get', '/v1/org/usage', rotated.body.secret)).status).toBe(200);
  });

  it('stops a revoked key on its very next call, and records it', async () => {
    const doomed = await makeKey(clientId, { label: 'Leaked' });
    expect((await org('get', '/v1/org/usage', doomed.secret)).status).toBe(200);
    expect((await staff('delete', `/v1/admin/clients/${clientId}/keys/${doomed.id}`)).status).toBe(204);
    const after = await org('get', '/v1/org/usage', doomed.secret);
    expect(after.status).toBe(401);
    expect((await staff('delete', `/v1/admin/clients/${clientId}/keys/${doomed.id}`)).status).toBe(404);

    const audit = (await staff('get', `/v1/admin/clients/${clientId}/audit?key=${doomed.id}`)).body;
    expect(audit.map((e: { event: string }) => e.event)).toEqual(expect.arrayContaining(['key.created', 'key.revoked', 'api.unauthorized']));
    expect(audit.find((e: { event: string }) => e.event === 'key.revoked')).toMatchObject({ alert: true, by: 'Staff Person' });
  });

  it('refuses a key that has expired', async () => {
    const short = await makeKey(clientId, { label: 'Short', expiresInDays: 1 });
    await ctx.db.query(`update public.api_keys set expires_at = now() - interval '1 minute' where id = $1`, [short.id]);
    expect((await org('get', '/v1/org/usage', short.secret)).status).toBe(401);
  });
});

describe('the audit log', () => {
  it('lists what happened, newest first, and exports it as a spreadsheet', async () => {
    const events = (await staff('get', `/v1/admin/clients/${clientId}/audit`)).body;
    expect(events[0]).toEqual({ at: expect.any(String), event: expect.any(String), keyPrefix: expect.anything(), by: expect.anything(), ip: expect.anything(), alert: expect.any(Boolean) });
    const times = events.map((e: { at: string }) => new Date(e.at).getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);

    const csv = await staff('get', `/v1/admin/clients/${clientId}/audit?format=csv`);
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.headers['content-disposition']).toContain('attachment');
    expect(csv.text.split('\n')[0]).toBe('at,event,key,by,ip');
    expect(csv.text.split('\n').length).toBe(events.length + 1);
    expect((await ctx.http().get(`/v1/admin/clients/${clientId}/audit`).set(ctx.as(student))).status).toBe(403);
  });
});

describe('sandbox keys', () => {
  let sandbox: { id: string; secret: string };

  beforeAll(async () => {
    sandbox = await makeKey(clientId, { label: 'Sandbox', mode: 'test' });
  });

  it('use made-up data, touch no one’s real record, and never use quota', async () => {
    expect(sandbox.secret).toMatch(/^trk_test_/);
    const profile = await org('get', `/v1/org/users/${key()}/profile`, sandbox.secret);
    expect(profile.status).toBe(200);
    expect(profile.body.name).toBe('Test Student');

    const link = await org('post', '/v1/org/consent-links', sandbox.secret, { scopes: ['read:profile'] });
    expect(link.body.url).toBe('http://localhost:3000/consent/sandbox');

    const before = (await row<{ n: number }>(`select count(*)::int as n from public.resume_documents`)).n;
    const resume = await org('post', `/v1/org/users/${student}/resumes`, sandbox.secret, { jobDescription: JOB, length: 'one_page' });
    expect(resume.status).toBe(202);
    expect(resume.body.jobId).toMatch(/^sbx_/);
    expect((await row<{ n: number }>(`select count(*)::int as n from public.resume_documents`)).n).toBe(before);

    const job = await org('get', `/v1/org/jobs/${resume.body.jobId}`, sandbox.secret);
    expect(job.body).toMatchObject({ status: 'succeeded', result: { resumeId: 'sbx_resume' } });
    expect((await org('get', `/v1/org/jobs/${resume.body.jobId}`, live.secret)).status).toBe(404);
  });
});

