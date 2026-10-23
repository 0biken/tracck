import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import {
  ApiError,
  PRICES_KOBO,
  type BillingView,
  type CheckoutPlan,
  type CheckoutResponse,
  type PriceTier,
  type VerifyPaymentResponse,
} from '@tracck/shared';
import type { ApiEnv } from '../config/env';
import { notConfigured } from '../common/not-configured';
import { AuditService } from '../core/audit.service';
import { EntitlementsService, periodResetsOn } from '../core/entitlements.service';
import { JobDispatcher } from '../core/job-dispatcher.service';
import { NotificationsService } from '../core/notifications.service';
import type { Database } from '../db';
import { payments, profiles, studentVerifications, subscriptions, webhookEvents } from '../db/schema';
import type { EmailSender } from '../email/email';
import { DB, EMAIL, ENV, PAYSTACK } from '../tokens';
import { validSignature, type PaystackCharge, type PaystackClient } from './paystack';

const rowsOf = <T>(result: unknown) => (result as { rows: T[] }).rows;
const sha = (value: string) => createHash('sha256').update(value).digest('hex');
const STUDENT_EMAIL = /^[^\s@]+@([a-z0-9-]+\.)+edu\.ng$/i;
/** A late renewal keeps the paid plan this long before it lapses. */
const GRACE_DAYS = 3;
const STUDENT_LINK_HOURS = 24;

const addMonth = (from: Date) => {
  const next = new Date(from);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
};

const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString('en-NG')}`;

interface PaystackEvent {
  event: string;
  data: Record<string, any>;
}

@Injectable()
export class BillingService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
    @Inject(PAYSTACK) private readonly paystack: PaystackClient,
    @Inject(EMAIL) private readonly email: EmailSender,
    @Inject(EntitlementsService) private readonly entitlements: EntitlementsService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(JobDispatcher) private readonly jobs: JobDispatcher,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  // ─── What the person sees ──────────────────────────────────────────────────

  async view(userId: string): Promise<BillingView> {
    const [profile] = await this.db.select().from(profiles).where(eq(profiles.id, userId));
    if (!profile) throw new ApiError(404, 'NOT_FOUND', 'We could not find your account.');
    const [subscription] = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);

    const { entitlements } = await this.entitlements.entitlementsOf(userId);
    const now = new Date();
    return {
      plan: profile.plan,
      priceTier: profile.plan === 'pro' ? (subscription?.priceTier ?? 'standard') : null,
      status: subscription?.status ?? 'none',
      currentPeriodEnd: subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toISOString() : null,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
      usage: {
        resumes: await this.entitlements.resumesUsed(userId, now),
        resumesLimit: entitlements.resumesPerMonth,
        sources: await this.entitlements.activeSources(userId),
        sourcesLimit: entitlements.maxSources,
        resetsOn: periodResetsOn(now),
      },
      studentVerified: Boolean(profile.studentVerifiedAt),
      studentEmail: profile.studentEmail,
      paymentsConfigured: this.paymentsConfigured(),
    };
  }

  private paymentsConfigured() {
    return Boolean(this.paystack.configured && this.env.PAYSTACK_PRO_PLAN_CODE && this.env.PAYSTACK_STUDENT_PLAN_CODE);
  }

  // ─── Paying ────────────────────────────────────────────────────────────────

  async checkout(userId: string, email: string | null, plan: CheckoutPlan, returnPath: string): Promise<CheckoutResponse> {
    if (!this.paymentsConfigured()) return notConfigured('Payments');
    if (!email) throw new ApiError(400, 'VALIDATION_ERROR', 'Your account has no email address to bill.');

    const [profile] = await this.db.select().from(profiles).where(eq(profiles.id, userId));
    if (plan === 'student' && !profile?.studentVerifiedAt) {
      throw new ApiError(403, 'FORBIDDEN', 'Confirm your student email first to get the student price.');
    }
    const [active] = await this.db
      .select({ cancel: subscriptions.cancelAtPeriodEnd })
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, 'active')))
      .limit(1);
    if (profile?.plan === 'pro' && active && !active.cancel) {
      throw new ApiError(409, 'CONFLICT', 'You are already on Pro.');
    }

    const reference = `trk_${randomUUID().replaceAll('-', '')}`;
    const tier: PriceTier = plan === 'student' ? 'student' : 'standard';
    const charge = await this.paystack.initialize({
      email,
      amountKobo: PRICES_KOBO[plan],
      reference,
      callbackUrl: `${this.env.APP_ORIGIN}${returnPath}`,
      planCode: (plan === 'student' ? this.env.PAYSTACK_STUDENT_PLAN_CODE : this.env.PAYSTACK_PRO_PLAN_CODE)!,
      metadata: { userId, plan, tier },
    });
    await this.db.insert(payments).values({
      userId,
      provider: 'paystack',
      providerReference: reference,
      amountMinor: BigInt(PRICES_KOBO[plan]),
      currency: 'NGN',
      status: 'pending',
    });
    return { authorizationUrl: charge.authorizationUrl, reference };
  }

  /** The person came back from the checkout page. Asking Paystack settles it even if the webhook is late. */
  async verify(userId: string, reference: string): Promise<VerifyPaymentResponse> {
    const [payment] = await this.db
      .select()
      .from(payments)
      .where(and(eq(payments.userId, userId), eq(payments.providerReference, reference)));
    if (!payment) throw new ApiError(404, 'NOT_FOUND', 'We could not find that payment.');

    if (payment.status !== 'succeeded') {
      const charge = await this.paystack.verify(reference);
      if (charge.status === 'success') await this.applyCharge(charge, userId, null);
      else if (charge.status === 'failed') await this.db.update(payments).set({ status: 'failed' }).where(eq(payments.id, payment.id));
      else return { status: 'pending', plan: await this.entitlements.planOf(userId) };
      if (charge.status === 'failed') return { status: 'failed', plan: await this.entitlements.planOf(userId) };
    }
    return { status: 'succeeded', plan: await this.entitlements.planOf(userId) };
  }

  /**
   * A successful charge turns the plan on. Safe to run twice for the same payment, and in
   * either order with a webhook: the payment row is the guard, and the paid-through date
   * only ever moves forward.
   */
  private async applyCharge(charge: PaystackCharge, userId: string | null, tierHint: PriceTier | null): Promise<void> {
    const [known] = await this.db.select().from(payments).where(eq(payments.providerReference, charge.reference));
    const owner = known?.userId ?? userId ?? (await this.ownerOf(charge));
    if (!owner) return;

    const [existing] = await this.db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, owner), eq(subscriptions.provider, 'paystack')))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);
    const tier: PriceTier = tierHint ?? (known && Number(known.amountMinor) === PRICES_KOBO.student ? 'student' : (existing?.priceTier ?? 'standard'));

    if (charge.amountKobo < PRICES_KOBO[tier === 'student' ? 'student' : 'pro']) {
      await this.db
        .insert(payments)
        .values({ userId: owner, provider: 'paystack', providerReference: charge.reference, amountMinor: BigInt(charge.amountKobo), currency: charge.currency, status: 'failed' })
        .onConflictDoUpdate({ target: [payments.provider, payments.providerReference], set: { status: 'failed' } });
      return;
    }

    const paidAt = charge.paidAt ? new Date(charge.paidAt) : new Date();
    const applied = await this.db.transaction(async (tx) => {
      const [row] = rowsOf<{ id: string }>(
        await tx.execute(sql`
          insert into public.payments (user_id, provider, provider_reference, amount_minor, currency, status, paid_at)
          values (${owner}, 'paystack', ${charge.reference}, ${charge.amountKobo}, ${charge.currency}, 'succeeded', ${paidAt.toISOString()})
          on conflict (provider, provider_reference) do update set status = 'succeeded', paid_at = excluded.paid_at, amount_minor = excluded.amount_minor
            where public.payments.status <> 'succeeded'
          returning id`),
      );
      if (!row) return false;

      const end = addMonth(paidAt);
      const [subscription] = existing
        ? await tx
            .update(subscriptions)
            .set({
              plan: 'pro',
              status: 'active',
              priceTier: tier,
              providerCustomerId: charge.customerCode ?? existing.providerCustomerId,
              currentPeriodStart: paidAt,
              // A late-arriving older charge must not shorten a period already paid for.
              currentPeriodEnd: existing.currentPeriodEnd && new Date(existing.currentPeriodEnd) > end ? existing.currentPeriodEnd : end,
              cancelAtPeriodEnd: known ? false : existing.cancelAtPeriodEnd,
            })
            .where(eq(subscriptions.id, existing.id))
            .returning({ id: subscriptions.id })
        : await tx
            .insert(subscriptions)
            .values({ userId: owner, provider: 'paystack', providerCustomerId: charge.customerCode, plan: 'pro', status: 'active', priceTier: tier, currentPeriodStart: paidAt, currentPeriodEnd: end })
            .returning({ id: subscriptions.id });
      await tx.update(payments).set({ subscriptionId: subscription.id }).where(eq(payments.id, row.id));
      await tx.update(profiles).set({ plan: 'pro' }).where(eq(profiles.id, owner));
      return true;
    });
    if (!applied) return;

    await this.audit.record({ userId: owner, eventType: 'billing.payment_succeeded', subjectType: 'payment', metadata: { tier, reference: charge.reference } });
    await this.notifications.notify({
      userId: owner,
      template: 'payment_received',
      payload: { plan: tier === 'student' ? 'Student Plus' : 'Pro', amount: naira(charge.amountKobo), reference: charge.reference },
      idempotencyKey: `payment:${charge.reference}`,
    });
    await this.jobs
      .dispatch({
        userId: owner,
        jobType: 'email_send',
        idempotencyKey: `email:payment:${charge.reference}`,
        input: { template: 'payment_received', data: { plan: tier === 'student' ? 'Student Plus' : 'Pro', amount: naira(charge.amountKobo), reference: charge.reference } },
      })
      .catch(() => {});
  }

  private async ownerOf(charge: PaystackCharge): Promise<string | null> {
    if (!charge.customerCode) return null;
    const [row] = await this.db.select({ userId: subscriptions.userId }).from(subscriptions).where(eq(subscriptions.providerCustomerId, charge.customerCode)).limit(1);
    return row?.userId ?? null;
  }

  // ─── Cancelling ────────────────────────────────────────────────────────────

  /** Stops the next renewal. The plan stays until the period that was paid for ends. */
  async cancel(userId: string): Promise<BillingView> {
    const [subscription] = await this.db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, 'active')))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);
    if (!subscription) throw new ApiError(409, 'CONFLICT', 'You have no plan to cancel.');

    if (subscription.providerSubscriptionId && subscription.providerEmailToken) {
      await this.paystack.disableSubscription(subscription.providerSubscriptionId, subscription.providerEmailToken);
    }
    // Without a provider subscription yet, the flag is acted on as soon as Paystack announces one.
    await this.db.update(subscriptions).set({ cancelAtPeriodEnd: true }).where(eq(subscriptions.id, subscription.id));
    await this.audit.record({ userId, eventType: 'billing.cancelled', subjectType: 'subscription', subjectId: subscription.id });
    return this.view(userId);
  }

  /** Plans whose paid period has ended go back to Free. Run daily. */
  async expireLapsed(now = new Date()): Promise<number> {
    const grace = new Date(now.getTime() - GRACE_DAYS * 86_400_000);
    const lapsed = rowsOf<{ id: string; user_id: string }>(
      await this.db.execute(sql`
        update public.subscriptions set status = 'expired'
         where status in ('active', 'past_due', 'cancelled')
           and current_period_end is not null
           and ((cancel_at_period_end and current_period_end < ${now.toISOString()}) or current_period_end < ${grace.toISOString()})
         returning id, user_id`),
    );
    for (const { user_id } of lapsed) {
      await this.db.execute(sql`
        update public.profiles set plan = 'free'
         where id = ${user_id}
           and not exists (select 1 from public.subscriptions where user_id = ${user_id} and status in ('active', 'trialing', 'past_due'))`);
    }
    return lapsed.length;
  }

  // ─── Student price ─────────────────────────────────────────────────────────

  async requestStudentVerification(userId: string, address: string): Promise<void> {
    if (!STUDENT_EMAIL.test(address)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Use your university email address. It ends in .edu.ng.');
    }
    if (!this.email.configured) return notConfigured('Email');

    const token = randomBytes(32).toString('base64url');
    await this.db.insert(studentVerifications).values({
      userId,
      email: address.toLowerCase(),
      tokenHash: sha(token),
      expiresAt: new Date(Date.now() + STUDENT_LINK_HOURS * 3_600_000),
    });
    await this.jobs.dispatch({
      userId,
      jobType: 'email_send',
      idempotencyKey: `student:${sha(token)}`,
      input: { template: 'student_verify', to: address, data: { url: `${this.env.API_PUBLIC_URL}/v1/billing/student-verification/confirm?token=${token}` } },
    });
  }

  /** Opened from the email. Possession of the link is the proof, so it needs no sign-in. Returns where to send the browser. */
  async confirmStudent(token: string | undefined): Promise<string> {
    const back = (outcome: string) => `${this.env.APP_ORIGIN}/dashboard/settings?student=${outcome}`;
    if (!token) return back('invalid');

    const [row] = await this.db
      .update(studentVerifications)
      .set({ usedAt: new Date() })
      .where(and(eq(studentVerifications.tokenHash, sha(token)), sql`${studentVerifications.usedAt} is null`, sql`${studentVerifications.expiresAt} > now()`))
      .returning();
    if (!row) return back('invalid');

    await this.db.update(profiles).set({ studentEmail: row.email, studentVerifiedAt: new Date() }).where(eq(profiles.id, row.userId));
    await this.audit.record({ userId: row.userId, eventType: 'billing.student_verified', subjectType: 'profile', subjectId: row.userId });
    return back('verified');
  }

  // ─── Webhook ───────────────────────────────────────────────────────────────

  async handleWebhook(rawBody: Buffer | undefined, signature: string | undefined): Promise<void> {
    if (!this.env.PAYSTACK_SECRET_KEY) return notConfigured('Payments');
    if (!rawBody || !validSignature(rawBody, signature, this.env.PAYSTACK_SECRET_KEY)) {
      throw new ApiError(401, 'INVALID_SIGNATURE', 'That request was not signed by the payment provider.');
    }
    const event = JSON.parse(rawBody.toString('utf8')) as PaystackEvent;
    const eventId = `${event.event}:${event.data?.id ?? event.data?.reference ?? event.data?.subscription_code ?? event.data?.next_payment_date ?? sha(rawBody.toString('utf8'))}`;

    const [recorded] = await this.db
      .insert(webhookEvents)
      .values({ provider: 'paystack', providerEventId: eventId, eventType: event.event, payloadJson: { event: event.event, reference: event.data?.reference ?? null } })
      .onConflictDoNothing()
      .returning({ id: webhookEvents.id });
    if (!recorded) {
      const [seen] = await this.db.select({ done: webhookEvents.processedAt }).from(webhookEvents).where(and(eq(webhookEvents.provider, 'paystack'), eq(webhookEvents.providerEventId, eventId)));
      // Delivered before and finished: nothing to do. Delivered but never finished: do it now.
      if (seen?.done) return;
    }

    await this.apply(event);
    await this.db.update(webhookEvents).set({ processedAt: new Date() }).where(and(eq(webhookEvents.provider, 'paystack'), eq(webhookEvents.providerEventId, eventId)));
  }

  private async apply(event: PaystackEvent): Promise<void> {
    const data = event.data ?? {};
    const subscriptionCode: string | undefined = data.subscription_code ?? data.subscription?.subscription_code;

    switch (event.event) {
      case 'charge.success':
        await this.applyCharge(
          {
            status: 'success',
            reference: data.reference,
            amountKobo: Number(data.amount),
            currency: data.currency ?? 'NGN',
            paidAt: data.paid_at ?? null,
            customerCode: data.customer?.customer_code ?? null,
            email: data.customer?.email ?? null,
          },
          typeof data.metadata?.userId === 'string' ? data.metadata.userId : null,
          data.metadata?.tier === 'student' ? 'student' : data.metadata?.tier === 'standard' ? 'standard' : null,
        );
        return;

      case 'subscription.create': {
        const customer: string | undefined = data.customer?.customer_code;
        if (!subscriptionCode || !customer) return;
        const [row] = await this.db
          .update(subscriptions)
          .set({ providerSubscriptionId: subscriptionCode, providerEmailToken: data.email_token ?? null })
          .where(and(eq(subscriptions.providerCustomerId, customer), sql`${subscriptions.providerSubscriptionId} is null`))
          .returning();
        // They asked to cancel before Paystack told us about the subscription: do it now.
        if (row?.cancelAtPeriodEnd && row.providerEmailToken) await this.paystack.disableSubscription(subscriptionCode, row.providerEmailToken);
        return;
      }

      case 'subscription.disable':
      case 'subscription.not_renew':
        if (subscriptionCode) await this.db.update(subscriptions).set({ cancelAtPeriodEnd: true }).where(eq(subscriptions.providerSubscriptionId, subscriptionCode));
        return;

      case 'invoice.payment_failed':
        if (subscriptionCode) {
          await this.db
            .update(subscriptions)
            .set({ status: 'past_due' })
            .where(and(eq(subscriptions.providerSubscriptionId, subscriptionCode), inArray(subscriptions.status, ['active', 'trialing'])));
        }
        return;

      default:
        // Events Tracck does not act on are recorded and acknowledged.
        return;
    }
  }

}
