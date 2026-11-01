import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EntitlementsService } from '../core/entitlements.service';
import { createTestApp, type TestApp } from '../test/harness';

const staffId = crypto.randomUUID();
let ctx: TestApp;
let regularUserId: string;
let secondUserId: string;

beforeAll(async () => {
  ctx = await createTestApp({ env: { STAFF_USER_IDS: staffId } });
  await ctx.db.query(
    `insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3::jsonb)`,
    [staffId, 'staff@tracck.app', JSON.stringify({ full_name: 'Tracck Admin' })],
  );
  regularUserId = await ctx.newUser('Adaobi Okafor');
  secondUserId = await ctx.newUser('Chidi Eze');
});

afterAll(() => ctx.close());

const http = () => ctx.http();
const as = (id: string) => ctx.as(id);

describe('Admin API (/v1/admin)', () => {
  it('exposes staff: true on /v1/me for staff and staff: false for regular users', async () => {
    const staffMe = await http().get('/v1/me').set(as(staffId));
    expect(staffMe.status).toBe(200);
    expect(staffMe.body.staff).toBe(true);

    const userMe = await http().get('/v1/me').set(as(regularUserId));
    expect(userMe.status).toBe(200);
    expect(userMe.body.staff).toBe(false);
  });

  it('rejects non-staff users on /v1/admin/* with 403 FORBIDDEN', async () => {
    const res = await http().get('/v1/admin/stats').set(as(regularUserId));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns platform stats for staff', async () => {
    const res = await http().get('/v1/admin/stats').set(as(staffId));
    expect(res.status).toBe(200);
    expect(res.body.users.total).toBeGreaterThanOrEqual(3);
    expect(res.body.content).toHaveProperty('sourcesTotal');
    expect(res.body.jobsLast24h).toHaveProperty('queued');
    expect(res.body.aiLast30d).toHaveProperty('calls');
    expect(res.body.queues).toHaveProperty('openDeletionRequests');
  });

  it('lists and filters users by search query, plan, and status', async () => {
    const all = await http().get('/v1/admin/users').set(as(staffId));
    expect(all.status).toBe(200);
    expect(all.body.items.length).toBeGreaterThanOrEqual(3);

    const search = await http().get('/v1/admin/users').query({ q: 'Adaobi' }).set(as(staffId));
    expect(search.status).toBe(200);
    expect(search.body.items).toHaveLength(1);
    expect(search.body.items[0].id).toBe(regularUserId);
    expect(search.body.items[0].name).toBe('Adaobi Okafor');
    expect(search.body.items[0].status).toBe('onboarding');
  });

  it('upgrades and downgrades a user plan and records an audit event', async () => {
    const upgraded = await http()
      .patch(`/v1/admin/users/${regularUserId}`)
      .set(as(staffId))
      .send({ plan: 'pro', reason: 'Beta scholarship' });
    expect(upgraded.status).toBe(200);
    expect(upgraded.body.plan).toBe('pro');
    expect(upgraded.body.usage.resumesLimit).toBeNull();

    const audit = upgraded.body.auditEvents.find(
      (e: { eventType: string }) => e.eventType === 'admin.user_plan_changed',
    );
    expect(audit).toBeDefined();
    expect(audit.actor).toBe(staffId);
    expect(audit.metadata).toMatchObject({
      previousPlan: 'free',
      newPlan: 'pro',
      reason: 'Beta scholarship',
    });

    const downgraded = await http()
      .patch(`/v1/admin/users/${regularUserId}`)
      .set(as(staffId))
      .send({ plan: 'free' });
    expect(downgraded.status).toBe(200);
    expect(downgraded.body.plan).toBe('free');
  });

  it('resets a user monthly resume quota and records an audit event', async () => {
    const entitlements = ctx.app.get(EntitlementsService);
    await entitlements.recordResume(regularUserId);
    await entitlements.recordResume(regularUserId);

    const before = await http().get(`/v1/admin/users/${regularUserId}`).set(as(staffId));
    expect(before.body.usage.resumesThisMonth).toBe(2);

    const after = await http().post(`/v1/admin/users/${regularUserId}/reset-quota`).set(as(staffId));
    expect(after.status).toBe(200);
    expect(after.body.usage.resumesThisMonth).toBe(0);
    expect(
      after.body.auditEvents.some((e: { eventType: string }) => e.eventType === 'admin.user_quota_reset'),
    ).toBe(true);
  });

  it('suspends a user, blocks their API requests with 403 ACCOUNT_SUSPENDED, and unsuspends them', async () => {
    const selfSuspend = await http()
      .patch(`/v1/admin/users/${staffId}`)
      .set(as(staffId))
      .send({ suspended: true });
    expect(selfSuspend.status).toBe(400);

    const suspended = await http()
      .patch(`/v1/admin/users/${regularUserId}`)
      .set(as(staffId))
      .send({ suspended: true, reason: 'Abuse check' });
    expect(suspended.status).toBe(200);
    expect(suspended.body.status).toBe('suspended');
    expect(suspended.body.suspendedAt).toBeTruthy();

    // Suspended user is blocked by AuthGuard
    const blocked = await http().get('/v1/me').set(as(regularUserId));
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('ACCOUNT_SUSPENDED');

    // Filter by suspended status
    const listSuspended = await http()
      .get('/v1/admin/users')
      .query({ status: 'suspended' })
      .set(as(staffId));
    expect(listSuspended.body.items.map((u: { id: string }) => u.id)).toContain(regularUserId);

    // Unsuspend
    const unsuspended = await http()
      .patch(`/v1/admin/users/${regularUserId}`)
      .set(as(staffId))
      .send({ suspended: false });
    expect(unsuspended.status).toBe(200);
    expect(unsuspended.body.suspendedAt).toBeNull();

    const restored = await http().get('/v1/me').set(as(regularUserId));
    expect(restored.status).toBe(200);
  });

  it('lists waitlist entries, triggers user deletion, and lists deletion requests and audit events', async () => {
    await http().post('/v1/waitlist').send({
      orgName: 'Tech Bridge',
      contactName: 'Tunde',
      email: 'tunde@techbridge.ng',
      orgType: 'bootcamp',
    });

    const waitlist = await http().get('/v1/admin/waitlist').set(as(staffId));
    expect(waitlist.status).toBe(200);
    expect(waitlist.body.some((w: { email: string }) => w.email === 'tunde@techbridge.ng')).toBe(true);

    const del = await http().delete(`/v1/admin/users/${secondUserId}`).set(as(staffId));
    expect(del.status).toBe(202);
    expect(del.body).toHaveProperty('requestId');
    expect(del.body).toHaveProperty('jobId');

    const deletionReqs = await http().get('/v1/admin/deletion-requests').set(as(staffId));
    expect(deletionReqs.status).toBe(200);
    expect(deletionReqs.body.some((r: { userId: string }) => r.userId === secondUserId)).toBe(true);

    const audit = await http().get('/v1/admin/audit').set(as(staffId));
    expect(audit.status).toBe(200);
    expect(audit.body.items.length).toBeGreaterThanOrEqual(4);
  });
});
