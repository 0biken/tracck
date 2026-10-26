import { unzipSync, strFromU8 } from 'fflate';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makePdf } from '../test/files';
import { createTestApp, type TestApp } from '../test/harness';

let ctx: TestApp;
let tolu: string;
let other: string;

const key = () => crypto.randomUUID();
const get = (path: string, user = tolu) => ctx.http().get(path).set(ctx.as(user));
const post = (path: string, user = tolu) => ctx.http().post(path).set(ctx.as(user)).set('Idempotency-Key', key());
const del = (path: string, user = tolu) => ctx.http().delete(path).set(ctx.as(user)).set('Idempotency-Key', key());
const count = async (table: string, user: string, column = 'user_id') =>
  Number((await ctx.db.query<{ n: number }>(`select count(*)::int as n from ${table} where ${column} = $1`, [user])).rows[0].n);

beforeAll(async () => {
  ctx = await createTestApp({ email: true });
  tolu = await ctx.newUser('Tolu Adebayo');
  other = await ctx.newUser('Someone Else');

  // Tolu has a CV, evidence, a resume and a plan; the other person has a little of their own.
  await post('/v1/me/consents/policy');
  await ctx.http().post('/v1/sources/cv').set(ctx.as(tolu)).set('Idempotency-Key', key()).attach('file', makePdf(), { filename: 'Tolu_CV.pdf', contentType: 'application/pdf' });
  await ctx.drain();
  await ctx.http().post('/v1/evidence').set(ctx.as(tolu)).send({ kind: 'project', title: 'Ledger service', body: 'Wrote the double-entry ledger service in TypeScript used by every product.' });
  await ctx.http().post('/v1/evidence').set(ctx.as(other)).send({ kind: 'project', title: 'Their own thing', body: 'Designed a mobile onboarding flow that other people never see.' });
  await ctx.db.query(`update public.profiles set plan = 'pro' where id = $1`, [tolu]);
  await ctx.db.query(
    `insert into public.subscriptions (user_id, provider, provider_subscription_id, provider_email_token, plan, status, current_period_end) values ($1, 'paystack', 'SUB_tolu', 'tok_tolu', 'pro', 'active', now() + interval '10 days')`,
    [tolu],
  );
  await ctx.drain();
});

afterAll(() => ctx.close());

describe('exporting your data', () => {
  it('needs a sign-in, and has nothing before the first request', async () => {
    expect((await ctx.http().post('/v1/me/export')).status).toBe(401);
    const none = await get('/v1/me/export/latest');
    expect(none.status).toBe(200);
    expect(none.body).toBeNull();
  });

  it('makes a zip of the person’s own data, and hands it over by short-lived link', async () => {
    const start = await post('/v1/me/export');
    expect(start.status).toBe(202);
    expect(start.body.statusUrl).toBe(`/v1/jobs/${start.body.jobId}`);
    await ctx.drain();

    const latest = await get('/v1/me/export/latest');
    expect(latest.status).toBe(200);
    expect(new Date(latest.body.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(typeof latest.body.url).toBe('string');

    const key = [...ctx.storage.objects.keys()].find((k) => k.startsWith(`users/${tolu}/exports/`))!;
    const files = unzipSync(new Uint8Array(ctx.storage.objects.get(key)!.body));
    expect(Object.keys(files)).toEqual(expect.arrayContaining(['README.txt', 'profile.json', 'evidence.json', 'sources.json', 'resumes.json', 'payments.json']));
    expect(Object.keys(files).some((name) => name.startsWith('uploads/') && name.endsWith('Tolu_CV.pdf'))).toBe(true);

    const evidence = JSON.parse(strFromU8(files['evidence.json']));
    expect(evidence.some((row: { text: string }) => row.text.includes('double-entry ledger'))).toBe(true);
    expect(JSON.stringify(evidence)).not.toContain('mobile onboarding');
    expect(JSON.parse(strFromU8(files['profile.json']))[0]).toMatchObject({ display_name: 'Tolu Adebayo', plan: 'pro' });

    // Provider tokens and the other person’s data are never in it.
    const everything = Object.values(files).map((file) => strFromU8(file)).join('\n');
    expect(everything).not.toMatch(/tok_tolu|access_token|encrypted/i);
  });

  it('emails when the export is ready', async () => {
    expect(ctx.email.sent.some((mail) => mail.subject === 'Your Tracck data export is ready')).toBe(true);
  });

  it('keeps one person’s export out of another’s hands', async () => {
    expect((await get('/v1/me/export/latest', other)).body).toBeNull();
  });
});

describe('deleting your account', () => {
  it('asks to be told plainly', async () => {
    expect((await ctx.http().delete('/v1/me').set(ctx.as(tolu)).set('Idempotency-Key', key())).status).toBe(400);
    expect((await del('/v1/me?confirm=yes')).status).toBe(400);
    expect(await count('auth.users', tolu, 'id')).toBe(1);
  });

  it('removes the person, their files and their data, stops billing, and leaves everyone else alone', async () => {
    expect([...ctx.storage.objects.keys()].some((k) => k.startsWith(`users/${tolu}/`))).toBe(true);
    await ctx.db.query(`insert into public.payments (user_id, provider, provider_reference, amount_minor, currency, status) values ($1, 'paystack', 'trk_kept_record', 250000, 'NGN', 'succeeded')`, [tolu]);

    const response = await del('/v1/me?confirm=delete-my-account');
    expect(response.status).toBe(202);
    const requestId = response.body.requestId;
    expect(await ctx.db.query(`select status from public.deletion_requests where id = $1`, [requestId])).toMatchObject({ rows: [{ status: 'requested' }] });
    await ctx.drain();

    expect(await count('auth.users', tolu, 'id')).toBe(0);
    expect(await count('public.profiles', tolu, 'id')).toBe(0);
    expect(await count('public.candidate_evidence', tolu)).toBe(0);
    expect(await count('public.source_items', tolu)).toBe(0);
    expect([...ctx.storage.objects.keys()].some((k) => k.startsWith(`users/${tolu}/`))).toBe(false);
    expect(ctx.paystack.disabled).toContainEqual({ code: 'SUB_tolu', token: 'tok_tolu' });

    const { rows } = await ctx.db.query<{ status: string; completed_at: string | null }>(`select status, completed_at from public.deletion_requests where id = $1`, [requestId]);
    expect(rows[0].status).toBe('completed');
    expect(rows[0].completed_at).not.toBeNull();
    expect(ctx.email.sent.at(-1)).toMatchObject({ subject: 'Your Tracck account was deleted' });

    // Payment records are kept for accounting, but no longer tied to the deleted person.
    expect(await ctx.db.query(`select user_id, amount_minor::int as amount from public.payments where provider_reference = 'trk_kept_record'`)).toMatchObject({ rows: [{ user_id: null, amount: 250000 }] });

    expect(await count('auth.users', other, 'id')).toBe(1);
    expect((await get('/v1/evidence', other)).body.counts.all).toBe(1);
  });

  it('is asked once however many times the button is pressed', async () => {
    const user = await ctx.newUser('Twice');
    const first = await del('/v1/me?confirm=delete-my-account', user);
    const second = await del('/v1/me?confirm=delete-my-account', user);
    expect(second.body.requestId).toBe(first.body.requestId);
    expect(second.body.jobId).toBe(first.body.jobId);
    await ctx.drain();
    expect(await count('auth.users', user, 'id')).toBe(0);
  });
});
