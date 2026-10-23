import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NotificationsService } from '../core/notifications.service';
import { createTestApp, type TestApp } from '../test/harness';

let ctx: TestApp;
let tolu: string;
let other: string;

const SECRET = 'sk_test_secret';
const key = () => crypto.randomUUID();
const get = (path: string, user = tolu) => ctx.http().get(path).set(ctx.as(user));
const post = (path: string, body?: object, user = tolu) => ctx.http().post(path).set(ctx.as(user)).set('Idempotency-Key', key()).send(body);
const row = async <T>(query: string, params: unknown[] = []) => (await ctx.db.query<T>(query, params)).rows[0];

/** A Paystack call: the body, signed the way Paystack signs it. */
const webhook = (event: object, signature?: string) => {
  const raw = JSON.stringify(event);
  return ctx
    .http()
    .post('/v1/webhooks/paystack')
    .set('content-type', 'application/json')
    .set('x-paystack-signature', signature ?? createHmac('sha512', SECRET).update(raw).digest('hex'))
    .send(raw);
};

const chargeEvent = (reference: string, extra: Record<string, unknown> = {}, id = Math.floor(Math.random() * 1e9)) => ({
  event: 'charge.success',
  data: { id, reference, status: 'success', amount: 250000, currency: 'NGN', paid_at: new Date().toISOString(), customer: { customer_code: 'CUS_tolu', email: 'tolu@example.com' }, ...extra },
});

beforeAll(async () => {
  ctx = await createTestApp({ email: true });
  tolu = await ctx.newUser('Tolu Adebayo');
  other = await ctx.newUser('Someone Else');
});

afterAll(() => ctx.close());

describe('the plan page', () => {
  it('needs a sign-in and starts on Free', async () => {
    expect((await ctx.http().get('/v1/billing')).status).toBe(401);
    const { body } = await get('/v1/billing');
    expect(body).toMatchObject({
      plan: 'free',
      priceTier: null,
      status: 'none',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      studentVerified: false,
      paymentsConfigured: true,
      usage: { resumes: 0, resumesLimit: 2, sources: 0, sourcesLimit: 1 },
    });
  });
});

describe('paying', () => {
  let reference: string;

  it('starts a Paystack checkout on the Pro plan and remembers the pending payment', async () => {
    const { status, body } = await post('/v1/billing/checkout', { plan: 'pro' });
    expect(status).toBe(200);
    reference = body.reference;
    expect(body.authorizationUrl).toBe(`https://checkout.paystack.test/${reference}`);
    expect(ctx.paystack.initialized.at(-1)).toMatchObject({
      email: `${tolu}@example.com`,
      amountKobo: 250000,
      planCode: 'PLN_pro',
      callbackUrl: 'http://localhost:3000/dashboard/settings',
      metadata: { userId: tolu, plan: 'pro', tier: 'standard' },
    });
    expect(await row(`select status, amount_minor::int as amount from public.payments where provider_reference = $1`, [reference])).toEqual({ status: 'pending', amount: 250000 });
  });

  it('only sends the person back to a page on this site', async () => {
    for (const returnPath of ['https://evil.example/steal', '//evil.example', 'javascript:alert(1)']) {
      expect((await post('/v1/billing/checkout', { plan: 'pro', returnPath })).status).toBe(400);
    }
    expect((await post('/v1/billing/checkout', { plan: 'pro', returnPath: '/dashboard/settings?paid=1' })).status).toBe(200);
  });

  it('keeps the student price for verified students', async () => {
    const refused = await post('/v1/billing/checkout', { plan: 'student' });
    expect(refused.status).toBe(403);
    expect(refused.body.error.code).toBe('FORBIDDEN');
    expect((await post('/v1/billing/checkout', { plan: 'enterprise' })).status).toBe(400);
  });

  it('says pending until Paystack confirms, and never trusts another person’s reference', async () => {
    expect((await get(`/v1/billing/verify?reference=${reference}`)).body).toEqual({ status: 'pending', plan: 'free' });
    expect((await get(`/v1/billing/verify?reference=${reference}`, other)).status).toBe(404);
    expect((await get('/v1/billing/verify?reference=x')).status).toBe(400);
  });

  it('turns Pro on when the payment went through, once, and tells the person', async () => {
    ctx.paystack.charges.set(reference, { status: 'success', amountKobo: 250000, paidAt: new Date().toISOString(), customerCode: 'CUS_tolu' });
    expect((await get(`/v1/billing/verify?reference=${reference}`)).body).toEqual({ status: 'succeeded', plan: 'pro' });
    expect((await get(`/v1/billing/verify?reference=${reference}`)).body).toEqual({ status: 'succeeded', plan: 'pro' });

    const { body } = await get('/v1/billing');
    expect(body).toMatchObject({ plan: 'pro', priceTier: 'standard', status: 'active', cancelAtPeriodEnd: false, usage: { resumesLimit: null, sourcesLimit: null } });
    expect(new Date(body.currentPeriodEnd).getTime()).toBeGreaterThan(Date.now() + 27 * 86_400_000);
    expect(await row(`select count(*)::int as n from public.subscriptions where user_id = $1`, [tolu])).toEqual({ n: 1 });
    expect(await row(`select count(*)::int as n from public.notifications where user_id = $1 and template = 'payment_received'`, [tolu])).toEqual({ n: 1 });
  });

  it('will not sell Pro to someone who already has it', async () => {
    expect((await post('/v1/billing/checkout', { plan: 'pro' })).status).toBe(409);
  });

  it('refuses a payment for less than the plan costs', async () => {
    const user = await ctx.newUser('Underpaid');
    const { body } = await post('/v1/billing/checkout', { plan: 'pro' }, user);
    ctx.paystack.charges.set(body.reference, { status: 'success', amountKobo: 1000, paidAt: new Date().toISOString() });
    await get(`/v1/billing/verify?reference=${body.reference}`, user);
    expect((await get('/v1/billing', user)).body.plan).toBe('free');
    expect(await row(`select status from public.payments where provider_reference = $1`, [body.reference])).toEqual({ status: 'failed' });
  });

  it('records a payment that failed', async () => {
    const user = await ctx.newUser('Declined');
    const { body } = await post('/v1/billing/checkout', { plan: 'pro' }, user);
    ctx.paystack.charges.set(body.reference, { status: 'failed' });
    expect((await get(`/v1/billing/verify?reference=${body.reference}`, user)).body).toEqual({ status: 'failed', plan: 'free' });
  });
});

describe('the Paystack webhook', () => {
  it('refuses a request that is not signed by Paystack', async () => {
    const event = chargeEvent('trk_forged');
    const bad = await webhook(event, 'a'.repeat(128));
    expect(bad.status).toBe(401);
    expect(bad.body.error.code).toBe('INVALID_SIGNATURE');
    expect((await ctx.http().post('/v1/webhooks/paystack').set('content-type', 'application/json').send(JSON.stringify(event))).status).toBe(401);
  });

  it('applies a signed charge, and applies a redelivery only once', async () => {
    const user = await ctx.newUser('Webhook');
    const { body } = await post('/v1/billing/checkout', { plan: 'pro' }, user);
    const event = chargeEvent(body.reference, { metadata: { userId: user, plan: 'pro', tier: 'standard' }, customer: { customer_code: 'CUS_hook', email: 'w@example.com' } }, 777);

    expect((await webhook(event)).status).toBe(200);
    expect((await webhook(event)).status).toBe(200);
    expect((await get('/v1/billing', user)).body.plan).toBe('pro');
    expect(await row(`select count(*)::int as n from public.webhook_events where provider_event_id = $1`, [`charge.success:777`])).toEqual({ n: 1 });
    expect(await row(`select count(*)::int as n from public.notifications where user_id = $1 and template = 'payment_received'`, [user])).toEqual({ n: 1 });
    expect(await row(`select count(*)::int as n from public.payments where user_id = $1 and status = 'succeeded'`, [user])).toEqual({ n: 1 });
  });

  it('does not let a late older charge shorten the paid period', async () => {
    const user = await ctx.newUser('Ordering');
    const first = (await post('/v1/billing/checkout', { plan: 'pro' }, user)).body.reference;
    const customer = { customer_code: 'CUS_order', email: 'o@example.com' };
    const recent = new Date().toISOString();
    await webhook(chargeEvent(first, { paid_at: recent, customer, metadata: { userId: user, tier: 'standard' } }, 1));
    const before = await row<{ end: string }>(`select current_period_end as "end" from public.subscriptions where user_id = $1`, [user]);

    const older = new Date(Date.now() - 20 * 86_400_000).toISOString();
    await webhook(chargeEvent('trk_renewal_older', { paid_at: older, customer }, 2));
    const after = await row<{ end: string }>(`select current_period_end as "end" from public.subscriptions where user_id = $1`, [user]);
    expect(new Date(after.end).getTime()).toBe(new Date(before.end).getTime());
  });

  describe('a subscription’s life', () => {
    let user: string;
    const customer = { customer_code: 'CUS_life', email: 'l@example.com' };

    beforeAll(async () => {
      user = await ctx.newUser('Lifecycle');
      const { body } = await post('/v1/billing/checkout', { plan: 'pro' }, user);
      await webhook(chargeEvent(body.reference, { customer, metadata: { userId: user, tier: 'standard' } }, 11));
    });

    it('renews on a charge Tracck did not start, found by the customer', async () => {
      const before = await row<{ end: string }>(`select current_period_end as "end" from public.subscriptions where user_id = $1`, [user]);
      await webhook(chargeEvent('trk_renewal_1', { customer, paid_at: new Date(Date.now() + 30 * 86_400_000).toISOString() }, 12));
      const after = await row<{ end: string }>(`select current_period_end as "end" from public.subscriptions where user_id = $1`, [user]);
      expect(new Date(after.end).getTime()).toBeGreaterThan(new Date(before.end).getTime());
      expect(await row(`select count(*)::int as n from public.subscriptions where user_id = $1`, [user])).toEqual({ n: 1 });
    });

    it('records the subscription Paystack made, so it can be stopped later', async () => {
      await webhook({ event: 'subscription.create', data: { subscription_code: 'SUB_life', email_token: 'tok_life', customer } });
      expect(await row(`select provider_subscription_id as code, provider_email_token as token from public.subscriptions where user_id = $1`, [user])).toEqual({ code: 'SUB_life', token: 'tok_life' });
    });

    it('marks it past due when a renewal fails, and active again after the next charge', async () => {
      await webhook({ event: 'invoice.payment_failed', data: { subscription: { subscription_code: 'SUB_life' }, customer } });
      expect((await get('/v1/billing', user)).body.status).toBe('past_due');
      await webhook(chargeEvent('trk_renewal_2', { customer }, 13));
      expect((await get('/v1/billing', user)).body.status).toBe('active');
    });

    it('stops renewing on cancel but keeps Pro until the period ends', async () => {
      const { status, body } = await post('/v1/billing/cancel', undefined, user);
      expect(status).toBe(200);
      expect(body).toMatchObject({ plan: 'pro', cancelAtPeriodEnd: true, status: 'active' });
      expect(ctx.paystack.disabled.at(-1)).toEqual({ code: 'SUB_life', token: 'tok_life' });
    });

    it('goes back to Free when the paid period is over, and not before', async () => {
      const { BillingService } = await import('./billing.service');
      const billing = ctx.app.get(BillingService);
      expect(await billing.expireLapsed()).toBe(0);
      expect((await get('/v1/billing', user)).body.plan).toBe('pro');

      await ctx.db.query(`update public.subscriptions set current_period_end = now() - interval '1 hour' where user_id = $1`, [user]);
      expect(await billing.expireLapsed()).toBe(1);
      expect((await get('/v1/billing', user)).body).toMatchObject({ plan: 'free', status: 'expired' });
    });
  });

  it('gives a late subscription announcement the cancel the person already asked for', async () => {
    const user = await ctx.newUser('Eager');
    const customer = { customer_code: 'CUS_eager', email: 'e@example.com' };
    const { body } = await post('/v1/billing/checkout', { plan: 'pro' }, user);
    await webhook(chargeEvent(body.reference, { customer, metadata: { userId: user, tier: 'standard' } }, 21));
    await post('/v1/billing/cancel', undefined, user);
    expect(ctx.paystack.disabled.find((d) => d.code === 'SUB_eager')).toBeUndefined();

    await ctx.db.query(`update public.subscriptions set provider_email_token = 'tok_eager' where user_id = $1`, [user]);
    await webhook({ event: 'subscription.create', data: { subscription_code: 'SUB_eager', email_token: 'tok_eager', customer } });
    expect(ctx.paystack.disabled.find((d) => d.code === 'SUB_eager')).toEqual({ code: 'SUB_eager', token: 'tok_eager' });
  });

  it('acknowledges events it does not act on', async () => {
    expect((await webhook({ event: 'customeridentification.success', data: { id: 99 } })).status).toBe(200);
  });

  it('has nothing to cancel on Free', async () => {
    expect((await post('/v1/billing/cancel', undefined, other)).status).toBe(409);
  });
});

describe('the student price', () => {
  let student: string;

  beforeAll(async () => {
    student = await ctx.newUser('Student');
  });

  it('wants a university address', async () => {
    for (const email of ['me@gmail.com', 'me@school.edu', 'me@edu.ng.example.com']) {
      expect((await post('/v1/billing/student-verification', { email }, student)).status).toBe(400);
    }
  });

  it('emails a link that works for a day, and confirms the student from it', async () => {
    await ctx.drain();
    const sent = await post('/v1/billing/student-verification', { email: 'Ada@Unilag.edu.ng' }, student);
    expect(sent.status).toBe(202);
    expect(await ctx.drain()).toEqual(['succeeded']);

    const mail = ctx.email.sent.at(-1)!;
    expect(mail.to).toBe('ada@unilag.edu.ng');
    expect(mail.subject).toBe('Confirm your student email');
    const link = mail.text.match(/http:\/\/localhost:4000(\/v1\/billing\/student-verification\/confirm\?token=[\w-]+)/)![1];

    const confirmed = await ctx.http().get(link);
    expect(confirmed.status).toBe(302);
    expect(confirmed.headers.location).toBe('http://localhost:3000/dashboard/settings?student=verified');
    expect((await get('/v1/billing', student)).body).toMatchObject({ studentVerified: true, studentEmail: 'ada@unilag.edu.ng' });

    // A link works once.
    expect((await ctx.http().get(link)).headers.location).toBe('http://localhost:3000/dashboard/settings?student=invalid');
    expect((await ctx.http().get('/v1/billing/student-verification/confirm?token=guess')).headers.location).toContain('student=invalid');
    expect((await ctx.http().get('/v1/billing/student-verification/confirm')).headers.location).toContain('student=invalid');
  });

  it('does not accept an expired link', async () => {
    const late = await ctx.newUser('Late');
    await post('/v1/billing/student-verification', { email: 'late@uam.edu.ng' }, late);
    await ctx.drain();
    const link = ctx.email.sent.at(-1)!.text.match(/(\/v1\/billing\/student-verification\/confirm\?token=[\w-]+)/)![1];
    await ctx.db.query(`update public.student_verifications set expires_at = now() - interval '1 minute' where user_id = $1`, [late]);
    expect((await ctx.http().get(link)).headers.location).toContain('student=invalid');
    expect((await get('/v1/billing', late)).body.studentVerified).toBe(false);
  });

  it('charges a verified student the student price', async () => {
    const { body } = await post('/v1/billing/checkout', { plan: 'student' }, student);
    expect(ctx.paystack.initialized.at(-1)).toMatchObject({ amountKobo: 100000, planCode: 'PLN_student', metadata: { plan: 'student', tier: 'student' } });
    ctx.paystack.charges.set(body.reference, { status: 'success', amountKobo: 100000, paidAt: new Date().toISOString(), customerCode: 'CUS_student' });
    await get(`/v1/billing/verify?reference=${body.reference}`, student);
    expect((await get('/v1/billing', student)).body).toMatchObject({ plan: 'pro', priceTier: 'student' });
  });
});

describe('email about what happened', () => {
  it('goes out for events the person wants, and not for the ones they turned off', async () => {
    const wants = await ctx.newUser('Wants');
    const quiet = await ctx.newUser('Quiet');
    await ctx.db.query(`update public.profiles set preferences_json = $2::jsonb where id = $1`, [quiet, JSON.stringify({ notifications: { done: false, weekly: true, attention: true } })]);
    await ctx.drain();
    const before = ctx.email.sent.length;

    const notifications = ctx.app.get(NotificationsService);
    for (const user of [wants, quiet]) {
      await notifications.notify({ userId: user, template: 'resume_ready', payload: { resumeId: crypto.randomUUID(), company: 'Paystack' }, idempotencyKey: `t:${user}` });
    }
    await ctx.drain();

    const sent = ctx.email.sent.slice(before);
    const address = (await ctx.db.query<{ email: string }>(`select email from auth.users where id = $1`, [wants])).rows[0].email;
    expect(sent.map((mail) => mail.to)).toEqual([address]);
    expect(sent[0]).toMatchObject({ subject: 'Your resume is ready' });
    expect(sent[0].text).toContain('Paystack');
    expect(sent[0].text).toContain('http://localhost:3000/dashboard/resumes/');
  });

  it('sends once however many times the event is reported', async () => {
    const user = await ctx.newUser('Once');
    const notifications = ctx.app.get(NotificationsService);
    const before = ctx.email.sent.length;
    for (let i = 0; i < 3; i++) await notifications.notify({ userId: user, template: 'source_ready', payload: { provider: 'github', entries: 4 }, idempotencyKey: 'same' });
    await ctx.drain();
    expect(ctx.email.sent.length - before).toBe(1);
  });

  it('tries again when the provider is down, and gives up on an address it rejects', async () => {
    const user = await ctx.newUser('Retry');
    const notifications = ctx.app.get(NotificationsService);
    await ctx.drain();
    const before = ctx.email.sent.length;

    ctx.email.fail = 'retryable';
    await notifications.notify({ userId: user, template: 'source_failed', payload: { message: 'Reconnect GitHub.' }, idempotencyKey: 'down' });
    expect(await ctx.drain()).toEqual(['retry_scheduled', 'retry_scheduled', 'failed']);

    ctx.email.fail = 'permanent';
    await notifications.notify({ userId: user, template: 'source_failed', payload: { message: 'Reconnect GitHub.' }, idempotencyKey: 'rejected' });
    expect(await ctx.drain()).toEqual(['failed']);
    expect(ctx.email.sent.length).toBe(before);

    ctx.email.fail = null;
    await notifications.notify({ userId: user, template: 'source_failed', payload: { message: 'Reconnect GitHub.' }, idempotencyKey: 'back' });
    expect(await ctx.drain()).toEqual(['succeeded']);
    expect(ctx.email.sent.length).toBe(before + 1);
  });
});
