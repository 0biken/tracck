import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { ApiError } from '@tracck/shared';
import { AuditService } from '../core/audit.service';
import { JobDispatcher } from '../core/job-dispatcher.service';
import type { Database } from '../db';
import { deletionRequests } from '../db/schema';
import type { ObjectStorage } from '../storage/storage';
import { DB, STORAGE } from '../tokens';

const EXPORT_LINK_SECONDS = 300;
const rowsOf = <T>(result: unknown) => (result as { rows: T[] }).rows;

/** A person's right to a copy of their data, and to have it deleted. */
@Injectable()
export class PrivacyService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(JobDispatcher) private readonly jobs: JobDispatcher,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async requestExport(userId: string, idempotencyKey: string, correlationId: string) {
    const { job } = await this.jobs.dispatch({ userId, jobType: 'data_export', idempotencyKey: `export-data:${idempotencyKey}`, input: {}, correlationId });
    await this.audit.record({ userId, eventType: 'privacy.export_requested', subjectType: 'job', subjectId: job.id, correlationId });
    return { jobId: job.id, ...this.jobs.statusUrls(job.id) };
  }

  /** The newest export, as a link that works for a few minutes. */
  async latestExport(userId: string): Promise<{ url: string; expiresAt: string; createdAt: string } | null> {
    const [job] = rowsOf<{ key: string; completed_at: string }>(
      await this.db.execute(sql`
        select result_ref_json ->> 'key' as key, completed_at from public.background_jobs
         where user_id = ${userId} and job_type = 'data_export' and status = 'succeeded' and result_ref_json ->> 'key' is not null
         order by completed_at desc limit 1`),
    );
    if (!job) return null;
    return {
      url: await this.storage.signedUrl(job.key, EXPORT_LINK_SECONDS),
      expiresAt: new Date(Date.now() + EXPORT_LINK_SECONDS * 1000).toISOString(),
      createdAt: new Date(job.completed_at).toISOString(),
    };
  }

  /** Starts deleting the account. It cannot be undone, so it is recorded with a due date as well as run. */
  async requestDeletion(userId: string, correlationId: string) {
    const [open] = await this.db
      .select({ id: deletionRequests.id })
      .from(deletionRequests)
      .where(and(eq(deletionRequests.userId, userId), sql`${deletionRequests.status} in ('requested', 'in_progress')`))
      .orderBy(desc(deletionRequests.requestedAt))
      .limit(1);
    const requestId =
      open?.id ?? (await this.db.insert(deletionRequests).values({ userId }).returning({ id: deletionRequests.id }))[0].id;

    const { job } = await this.jobs.dispatch({ userId, jobType: 'account_deletion', idempotencyKey: `delete-account:${requestId}`, input: { requestId }, correlationId });
    await this.audit.record({ userId, eventType: 'privacy.deletion_requested', subjectType: 'deletion_request', subjectId: requestId, correlationId });
    return { requestId, jobId: job.id, ...this.jobs.statusUrls(job.id) };
  }

  static assertConfirmed(confirm: string | undefined) {
    if (confirm !== 'delete-my-account') {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Confirm that you want to delete your account.');
    }
  }
}
