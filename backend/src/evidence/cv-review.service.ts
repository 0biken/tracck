import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { ApiError, JobError, ROLE_IDS, type CvReviewView, type RoleId } from '@tracck/shared';
import type { AiEngine } from '../ai/ai-engine';
import { JobDispatcher } from '../core/job-dispatcher.service';
import type { Database } from '../db';
import type { JobHandler } from '../jobs/runner';
import { AI_ENGINE, DB } from '../tokens';

const rowsOf = <T>(result: unknown) => (result as { rows: T[] }).rows;
const asRole = (value: string | null): RoleId | null => ((ROLE_IDS as readonly string[]).includes(value ?? '') ? (value as RoleId) : null);

/** Feedback on the CV the person uploaded: what to fix, with the line it is about. */
@Injectable()
export class CvReviewService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(AI_ENGINE) private readonly ai: AiEngine,
    @Inject(JobDispatcher) private readonly jobs: JobDispatcher,
  ) {}

  async latest(userId: string): Promise<CvReviewView | null> {
    const [row] = rowsOf<{ id: string; role: string | null; engine: string; result: Omit<CvReviewView, 'id' | 'readAt' | 'engine' | 'roleFamily'> & { file: string | null }; created_at: string }>(
      await this.db.execute(sql`
        select id, role_family as role, engine, result_json as result, created_at
          from public.cv_reviews where user_id = ${userId} order by created_at desc limit 1`),
    );
    if (!row) return null;
    return {
      id: row.id,
      file: row.result.file ?? null,
      roleFamily: asRole(row.role),
      readAt: new Date(row.created_at).toISOString(),
      stats: row.result.stats ?? [],
      issues: row.result.issues ?? [],
      engine: row.engine,
    };
  }

  /** Reads the CV the person has on file, again whenever they ask. */
  async request(userId: string, idempotencyKey: string, correlationId: string) {
    const cv = await this.currentCv(userId);
    if (!cv) throw new ApiError(400, 'VALIDATION_ERROR', 'Upload your CV first, then we can give you feedback on it.');
    const { job } = await this.jobs.dispatch({
      userId,
      jobType: 'cv_review',
      idempotencyKey,
      input: { sourceItemId: cv.id },
      correlationId,
    });
    return { jobId: job.id, ...this.jobs.statusUrls(job.id) };
  }

  private async currentCv(userId: string) {
    const [row] = rowsOf<{ id: string; title: string | null; text: string | null }>(
      await this.db.execute(sql`
        select i.id, i.title, i.body_text as text
          from public.source_items i
          join public.source_connections c on c.id = i.connection_id
         where i.user_id = ${userId} and c.provider = 'cv' and c.revoked_at is null
           and i.deletion_status = 'active' and i.body_text is not null
         order by i.imported_at desc limit 1`),
    );
    return row ?? null;
  }

  handle: JobHandler = async (ctx) => {
    const userId = ctx.job.userId;
    const cv = await this.currentCv(userId);
    if (!cv?.text) throw new JobError('permanent', 'FILE_MISSING', 'We no longer have your CV. Upload it again.');

    const [profile] = rowsOf<{ role: string | null }>(
      await this.db.execute(sql`select primary_role as role from public.profiles where id = ${userId}`),
    );
    await ctx.setStep('critique', 30);
    const review = await this.ai.reviewCv({ text: cv.text, file: cv.title, roleId: asRole(profile?.role ?? null) });

    const [saved] = rowsOf<{ id: string }>(
      await this.db.execute(sql`
        insert into public.cv_reviews (user_id, source_item_id, role_family, result_json, engine)
        values (${userId}, ${cv.id}, ${review.roleFamily}, ${JSON.stringify({ file: review.file, stats: review.stats, issues: review.issues })}::jsonb, ${this.ai.name})
        returning id`),
    );
    return { reviewId: saved.id, issues: review.issues.length };
  };
}
