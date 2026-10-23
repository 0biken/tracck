import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { JobError, hasAttemptsLeft } from '@tracck/shared';
import type { PaystackClient } from '../billing/paystack';
import type { Database } from '../db';
import { deletionRequests, subscriptions } from '../db/schema';
import type { EmailSender } from '../email/email';
import { renderEmail } from '../email/templates';
import type { ApiEnv } from '../config/env';
import type { JobHandler } from '../jobs/runner';
import type { ObjectStorage } from '../storage/storage';
import { DB, EMAIL, ENV, PAYSTACK, STORAGE } from '../tokens';

/**
 * Deletes a person and everything of theirs: stops billing, removes every stored file,
 * then removes the account itself, which removes the rest of their rows with it. What
 * stays is a record that the deletion was requested and when it finished.
 */
@Injectable()
export class AccountDeletionHandler {
  private readonly logger = new Logger('Deletion');

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(STORAGE) private readonly storage: ObjectStorage,
    @Inject(PAYSTACK) private readonly paystack: PaystackClient,
    @Inject(EMAIL) private readonly email: EmailSender,
    @Inject(ENV) private readonly env: ApiEnv,
  ) {}

  handle: JobHandler = async (ctx) => {
    const userId = ctx.job.userId;
    const requestId = String(ctx.job.inputRef.requestId ?? '');
    await this.db.update(deletionRequests).set({ status: 'in_progress' }).where(and(eq(deletionRequests.id, requestId), eq(deletionRequests.userId, userId)));

    const address = ((await this.db.execute(sql`select email from auth.users where id = ${userId}`)) as unknown as { rows: { email: string | null }[] }).rows[0]?.email ?? null;
    const finalAttempt = !hasAttemptsLeft(ctx.job.attemptCount, ctx.job.maxAttempts);

    try {
      await ctx.setStep('validate', 15);
      await this.stopBilling(userId);

      await ctx.setStep('validate', 45);
      await this.storage.removePrefix(`users/${userId}/`).catch((error: unknown) => {
        // Storage that is not set up has nothing to remove. A real failure is worth another try.
        if (!(error instanceof Error && /not set up/.test(error.message))) throw error;
      });

      await ctx.setStep('validate', 75);
      await this.db.execute(sql`delete from auth.users where id = ${userId}`);
    } catch (error) {
      if (error instanceof JobError) throw error;
      await this.db.update(deletionRequests).set({ status: finalAttempt ? 'failed' : 'in_progress' }).where(eq(deletionRequests.id, requestId));
      this.logger.error(`deletion ${requestId} failed: ${error instanceof Error ? error.name : 'unknown'}`);
      throw new JobError('retryable', 'DELETION_FAILED', 'We could not finish deleting your account yet. We will try again.');
    }

    await this.db.update(deletionRequests).set({ status: 'completed', completedAt: new Date() }).where(eq(deletionRequests.id, requestId));
    await this.confirm(address);
    // The job row went with the account, so there is nothing left to report to.
    return { requestId };
  };

  /** A paid plan is stopped at Paystack first, so a deleted person is never billed again. */
  private async stopBilling(userId: string) {
    const [subscription] = await this.db
      .select({ code: subscriptions.providerSubscriptionId, token: subscriptions.providerEmailToken })
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, userId), sql`${subscriptions.status} in ('active', 'past_due')`));
    if (subscription?.code && subscription.token && this.paystack.configured) {
      await this.paystack.disableSubscription(subscription.code, subscription.token);
    }
  }

  private async confirm(address: string | null) {
    if (!address || !this.email.configured) return;
    const rendered = renderEmail('account_deleted', {}, this.env.APP_ORIGIN);
    if (rendered) await this.email.send({ to: address, ...rendered }).catch(() => {});
  }
}
