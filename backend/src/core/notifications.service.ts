import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Database } from '../db';
import { notifications, profiles } from '../db/schema';
import { EMAIL_PREFERENCE } from '../email/templates';
import type { EmailSender } from '../email/email';
import { DB, EMAIL } from '../tokens';
import { JobDispatcher } from './job-dispatcher.service';

export interface NotifyInput {
  userId: string;
  /** For example "source_ready" or "resume_ready". */
  template: string;
  payload: Record<string, unknown>;
  jobId?: string;
  /** One notification per event, however many times a job is delivered. */
  idempotencyKey: string;
}

/**
 * Tells a person something happened. It always leaves an in-app notice. It also sends
 * an email when email is set up, the event is one worth an email, and the person has
 * not turned that kind off.
 */
@Injectable()
export class NotificationsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(JobDispatcher) private readonly jobs: JobDispatcher,
    @Inject(EMAIL) private readonly email: EmailSender,
  ) {}

  async notify(input: NotifyInput): Promise<void> {
    try {
      await this.db
        .insert(notifications)
        .values({
          userId: input.userId,
          jobId: input.jobId,
          channel: 'in_app',
          template: input.template,
          payloadJson: input.payload,
          idempotencyKey: input.idempotencyKey,
          deliveryStatus: 'sent',
          sentAt: new Date(),
        })
        .onConflictDoNothing();
    } catch {
      // A notice is never worth failing the work it reports on.
    }
    await this.sendEmail(input);
  }

  private async sendEmail(input: NotifyInput): Promise<void> {
    const kind = EMAIL_PREFERENCE[input.template];
    if (!kind || !this.email.configured) return;
    try {
      const [profile] = await this.db.select({ preferences: profiles.preferencesJson }).from(profiles).where(eq(profiles.id, input.userId));
      const settings = (profile?.preferences as { notifications?: Record<string, boolean> } | undefined)?.notifications;
      // Every kind is on until the person turns it off.
      if (settings?.[kind] === false) return;
      await this.jobs.dispatch({
        userId: input.userId,
        jobType: 'email_send',
        idempotencyKey: `email:${input.idempotencyKey}`,
        input: { template: input.template, data: input.payload },
      });
    } catch {
      // Same rule: email is a courtesy on top of the in-app notice.
    }
  }
}
