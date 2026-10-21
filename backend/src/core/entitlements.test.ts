import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EntitlementsService, periodResetsOn, periodStart } from './entitlements.service';
import { createTestApp, type TestApp } from '../test/harness';

let ctx: TestApp;
let entitlements: EntitlementsService;

beforeAll(async () => {
  ctx = await createTestApp();
  entitlements = ctx.app.get(EntitlementsService);
});

afterAll(() => ctx.close());

const rejects = (promise: Promise<unknown>) => promise.then(() => null, (error: unknown) => error as { status: number; code: string; message: string });

describe('plan limits', () => {
  it('keys the month on its first day in UTC', () => {
    const now = new Date('2026-10-21T23:30:00Z');
    expect(periodStart(now)).toBe('2026-10-01');
    expect(periodResetsOn(now)).toBe('2026-11-01');
    expect(periodResetsOn(new Date('2026-12-31T12:00:00Z'))).toBe('2027-01-01');
  });

  it('lets a free user generate twice, then says when it resets', async () => {
    const user = await ctx.newUser();
    await entitlements.assertCanGenerate(user, 'one_page');
    await entitlements.recordResume(user);
    await entitlements.assertCanGenerate(user, 'one_page');
    await entitlements.recordResume(user);

    const error = await rejects(entitlements.assertCanGenerate(user, 'one_page'));
    expect(error).toMatchObject({ status: 402, code: 'PLAN_LIMIT_REACHED' });
    expect(error!.message).toContain(periodResetsOn());
  });

  it('gives a resume back when a run fails, and never goes below zero', async () => {
    const user = await ctx.newUser();
    await entitlements.recordResume(user);
    await entitlements.refundResume(user);
    await entitlements.refundResume(user);
    expect(await entitlements.resumesUsed(user)).toBe(0);
  });

  it('keeps full length and Word export for paid plans', async () => {
    const user = await ctx.newUser();
    expect(await rejects(entitlements.assertCanGenerate(user, 'full'))).toMatchObject({ code: 'PLAN_LIMIT_REACHED' });
    expect(await rejects(entitlements.assertCanExport(user, 'docx'))).toMatchObject({ code: 'PLAN_LIMIT_REACHED' });
    await entitlements.assertCanExport(user, 'pdf');

    await ctx.db.query(`update public.profiles set plan = 'pro' where id = $1`, [user]);
    await entitlements.assertCanGenerate(user, 'full');
    await entitlements.assertCanExport(user, 'docx');
    for (let i = 0; i < 5; i++) await entitlements.recordResume(user);
    await entitlements.assertCanGenerate(user, 'one_page');
  });

  it('allows one source on the free plan', async () => {
    const user = await ctx.newUser();
    await entitlements.assertCanAddSource(user);
    await ctx.db.query(
      `insert into public.source_connections (user_id, provider, consent_version) values ($1, 'cv', 'v1')`,
      [user],
    );
    expect(await rejects(entitlements.assertCanAddSource(user))).toMatchObject({ status: 402, code: 'PLAN_LIMIT_REACHED' });
  });
});
