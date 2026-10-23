import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { NotificationsService } from '../core/notifications.service';
import type { Database } from '../db';
import type { JobHandler } from '../jobs/runner';
import { DB } from '../tokens';

/** Tells a person what their sources added this week. Sends nothing when nothing was added. */
@Injectable()
export class WeeklyDigestHandler {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  handle: JobHandler = async (ctx) => {
    const userId = ctx.job.userId;
    const [row] = (
      (await this.db.execute(sql`
        select count(*)::int as n from public.candidate_evidence
         where user_id = ${userId} and not excluded and created_at > now() - interval '7 days'`)) as unknown as { rows: { n: number }[] }
    ).rows;
    const entries = row?.n ?? 0;
    if (entries === 0) return { sent: false };

    await this.notifications.notify({
      userId,
      jobId: ctx.job.id,
      template: 'weekly_digest',
      payload: { entries },
      idempotencyKey: `weekly_digest:${ctx.job.id}`,
    });
    return { sent: true, entries };
  };
}
