import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { JobError } from '@tracck/shared';
import type { ApiEnv } from '../config/env';
import type { Database } from '../db';
import type { JobHandler } from '../jobs/runner';
import { DB, EMAIL, ENV } from '../tokens';
import { EmailError, type EmailSender } from './email';
import { renderEmail } from './templates';

/** Sends one email. The address is read when it is sent, so a job never carries it unless it must. */
@Injectable()
export class EmailSendHandler {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(EMAIL) private readonly sender: EmailSender,
    @Inject(ENV) private readonly env: ApiEnv,
  ) {}

  handle: JobHandler = async (ctx) => {
    const { template, data, to } = ctx.job.inputRef as { template: string; data?: Record<string, unknown>; to?: string };
    const rendered = renderEmail(template, data ?? {}, this.env.APP_ORIGIN);
    if (!rendered) throw new JobError('permanent', 'UNKNOWN_TEMPLATE', 'That email does not exist.');

    const address = to ?? (await this.addressOf(ctx.job.userId));
    if (!address) return { sent: false, reason: 'no_address' };
    if (!this.sender.configured) return { sent: false, reason: 'not_configured' };

    try {
      await this.sender.send({ to: address, ...rendered });
    } catch (error) {
      if (error instanceof EmailError && error.kind === 'permanent') throw new JobError('permanent', 'EMAIL_REJECTED', 'The email could not be delivered.');
      throw new JobError('retryable', 'EMAIL_FAILED', 'The email could not be sent yet. We will try again.');
    }
    return { sent: true };
  };

  private async addressOf(userId: string): Promise<string | null> {
    const result = (await this.db.execute(sql`select email from auth.users where id = ${userId}`)) as unknown as { rows: { email: string | null }[] };
    return result.rows[0]?.email ?? null;
  }
}
