import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from '../test/harness';

let ctx: TestApp;
let userId: string;
let otherId: string;

beforeAll(async () => {
  ctx = await createTestApp();
  userId = await ctx.newUser('Tolu Adebayo');
  otherId = await ctx.newUser('Someone Else');
});

afterAll(() => ctx.close());

const get = (path: string, user = userId) => ctx.http().get(path).set(ctx.as(user));
const send = (method: 'post' | 'put' | 'patch' | 'delete', path: string, body?: object, user = userId) =>
  ctx.http()[method](path).set(ctx.as(user)).send(body);

describe('profile', () => {
  it('returns the profile made at signup, with defaults', async () => {
    const { status, body } = await get('/v1/me');
    expect(status).toBe(200);
    expect(body).toMatchObject({
      id: userId,
      email: `${userId}@example.com`,
      name: 'Tolu Adebayo',
      plan: 'free',
      onboardingCompleted: false,
      policyAccepted: false,
      roles: [],
      preferences: { notifications: { done: true, weekly: true, attention: true }, cvRetention: '12_months' },
    });
  });

  it('updates name, location and roles, and the first role becomes the primary one', async () => {
    const { status, body } = await send('patch', '/v1/me', {
      name: 'Tolu A.',
      location: 'Ibadan, Nigeria',
      roles: ['devrel', 'dev'],
    });
    expect(status).toBe(200);
    expect(body).toMatchObject({ name: 'Tolu A.', location: 'Ibadan, Nigeria', roles: ['devrel', 'dev'], primaryRole: 'devrel' });
  });

  it('refuses unknown roles and unknown fields', async () => {
    expect((await send('patch', '/v1/me', { roles: ['wizard'] })).status).toBe(400);
    expect((await send('patch', '/v1/me', { plan: 'pro' })).status).toBe(400);
    expect((await send('put', '/v1/me/roles', { roles: [] })).status).toBe(400);
    expect((await get('/v1/me')).body.plan).toBe('free');
  });

  it('sets roles on their own', async () => {
    const { body } = await send('put', '/v1/me/roles', { roles: ['ux'] });
    expect(body).toMatchObject({ roles: ['ux'], primaryRole: 'ux' });
  });

  it('keeps preferences between requests', async () => {
    const preferences = {
      notifications: { done: false, weekly: true, attention: false },
      cvRetention: 'until_deleted',
    };
    expect((await send('put', '/v1/me/preferences', preferences)).status).toBe(200);
    expect((await get('/v1/me')).body.preferences).toEqual(preferences);
    expect((await send('put', '/v1/me/preferences', { notifications: {}, cvRetention: '1_day' })).status).toBe(400);
  });

  it('records agreement to the policies once and finishes onboarding', async () => {
    expect((await send('post', '/v1/me/consents/policy')).status).toBe(200);
    expect((await send('post', '/v1/me/consents/policy')).status).toBe(200);
    expect((await get('/v1/me')).body).toMatchObject({ policyAccepted: true, onboardingCompleted: true });
    const { rows } = await ctx.db.query(`select count(*)::int as n from public.user_policy_consents where user_id = $1`, [userId]);
    expect(rows[0]).toEqual({ n: 3 });
  });

});

describe('home summary', () => {
  it('is all zeros for a new account', async () => {
    const fresh = await ctx.newUser();
    const { body } = await get('/v1/me/summary', fresh);
    expect(body).toMatchObject({
      entries: 0,
      sourcesTotal: 0,
      sourcesReady: 0,
      resumes: 0,
      resumesThisMonth: 0,
      resumesLimit: 2,
      cvWeaknesses: null,
      entriesSince: null,
    });
    expect(body.bySource).toMatchObject({ github: 0, cv: 0, manual: 0 });
  });

  it('counts only the caller’s own record', async () => {
    const insert = (user: string, provider: string, extra = '') =>
      ctx.db.query(
        `insert into public.candidate_evidence (user_id, evidence_type, claim_text, title, source_provider, project_key ${extra ? ', ' + extra.split('=')[0] : ''})
         values ($1, 'project', 'Built a thing', 'A thing', $2, 'proj-a' ${extra ? ', ' + extra.split('=')[1] : ''})`,
        [user, provider],
      );
    await insert(userId, 'github');
    await insert(userId, 'github');
    await insert(userId, 'cv', 'pinned=true');
    await insert(otherId, 'github');
    await ctx.db.query(
      `insert into public.source_connections (user_id, provider, status, consent_version, last_sync_at) values ($1, 'github', 'synced', 'v1', now())`,
      [userId],
    );

    const { body } = await get('/v1/me/summary');
    expect(body).toMatchObject({ entries: 3, pinned: 1, projects: 1, sourcesTotal: 1, sourcesReady: 1 });
    expect(body.bySource).toMatchObject({ github: 2, cv: 1 });
    expect(body.entriesSince.count).toBe(3);
    expect(body.lastCollectedAt).not.toBeNull();
    expect(new Date(body.nextRefreshAt).getUTCHours()).toBe(6);
  });
});

describe('notifications', () => {
  it('lists and reads the caller’s own, and no one else’s', async () => {
    const { rows } = await ctx.db.query<{ id: string }>(
      `insert into public.notifications (user_id, channel, template, idempotency_key) values ($1, 'in_app', 'resume_ready', 'k1') returning id`,
      [userId],
    );
    const id = rows[0].id;

    expect((await get('/v1/notifications')).body.items).toHaveLength(1);
    expect((await get('/v1/notifications', otherId)).body.items).toHaveLength(0);
    expect((await send('post', `/v1/notifications/${id}/read`, undefined, otherId)).status).toBe(404);
    expect((await send('post', `/v1/notifications/${id}/read`)).status).toBe(204);
    expect((await get('/v1/notifications')).body.items[0].readAt).not.toBeNull();
  });
});

describe('organisations with access', () => {
  it('lists what each organisation holds and revokes it', async () => {
    const { rows } = await ctx.db.query<{ id: string }>(
      `insert into public.api_clients (name, status) values ('UNILAG Careers Office', 'active') returning id`,
    );
    const clientId = rows[0].id;
    for (const scope of ['read:profile', 'read:resume']) {
      await ctx.db.query(`insert into public.consents (user_id, client_id, scope) values ($1, $2, $3)`, [userId, clientId, scope]);
    }

    const { body } = await get('/v1/me/consents');
    expect(body.granted).toHaveLength(1);
    expect(body.granted[0]).toMatchObject({ id: clientId, orgName: 'UNILAG Careers Office' });
    expect(body.granted[0].scopes.sort()).toEqual(['read:profile', 'read:resume']);

    expect((await send('delete', `/v1/me/consents/${clientId}`, undefined, otherId)).status).toBe(404);
    expect((await send('delete', `/v1/me/consents/${clientId}`)).status).toBe(204);
    expect((await get('/v1/me/consents')).body.granted).toHaveLength(0);
  });
});

describe('waitlist', () => {
  const entry = (email: string) => ({
    orgName: 'UNILAG Careers',
    contactName: 'Funmi Lawal',
    email,
    orgType: 'university',
  });

  it('takes an entry without sign-in, once per address however it is written', async () => {
    expect((await ctx.http().post('/v1/waitlist').send(entry('funmi@unilag.edu.ng'))).status).toBe(200);
    expect((await ctx.http().post('/v1/waitlist').send(entry('FUNMI@unilag.edu.ng'))).status).toBe(200);
    const { rows } = await ctx.db.query(`select count(*)::int as n from public.org_waitlist`);
    expect(rows[0]).toEqual({ n: 1 });
  });

  it('checks the entry', async () => {
    expect((await ctx.http().post('/v1/waitlist').send(entry('not-an-email'))).status).toBe(400);
    expect((await ctx.http().post('/v1/waitlist').send({ ...entry('a@b.co'), orgType: 'club' })).status).toBe(400);
    expect((await ctx.http().post('/v1/waitlist').send({ ...entry('a@b.co'), extra: 1 })).status).toBe(400);
  });

  it('slows down an address that keeps trying', async () => {
    const limited = await createTestApp();
    for (let i = 0; i < 5; i++) {
      expect((await limited.http().post('/v1/waitlist').send(entry(`user${i}@school.edu.ng`))).status).toBe(200);
    }
    const sixth = await limited.http().post('/v1/waitlist').send(entry('user6@school.edu.ng'));
    expect(sixth.status).toBe(429);
    expect(sixth.body.error.code).toBe('RATE_LIMITED');
    await limited.close();
  });
});
