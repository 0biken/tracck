// Puts embedding work on the job queue. A failed embedding is then retried with backoff
// rather than lost. The work itself is ContextService.index, which is safe to repeat.

import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { ApiEnv } from '../config/env';
import { JobDispatcher } from '../core/job-dispatcher.service';
import { JOB_STORE } from '../tokens';
import type { JobStore } from '@tracck/shared';
import type { Database } from '../db';
import { DB, ENV } from '../tokens';

const rowsOf = <T>(result: unknown) => (result as { rows: T[] }).rows;

/** Retries spaced out exponentially by the job runner: a few minutes of model outage is survived. */
export const INDEX_MAX_ATTEMPTS = 8;

@Injectable()
export class EmbeddingSyncService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
    @Inject(JobDispatcher) private readonly jobs: JobDispatcher,
    @Inject(JOB_STORE) private readonly store: JobStore,
  ) {}

  /**
   * Refresh's part in keeping embeddings current: an index run that is waiting on a long retry, or
   * was queued and never started, is cancelled, and a fresh run starts now.
   */
  async restartStalled(userId: string): Promise<void> {
    if (!this.env.GEMINI_API_KEY) return;
    const stalled = rowsOf<{ id: string }>(
      await this.db.execute(sql`
        select id from public.background_jobs
         where user_id = ${userId} and job_type = 'profile_index'
           and (status = 'retry_wait' or (status = 'queued' and created_at < now() - interval '10 minutes'))`),
    );
    for (const job of stalled) await this.store.requestCancel(job.id, userId);
    await this.schedule(userId);
  }

  /**
   * Queues an index run for the person. Does nothing without a model, or while a run is already
   * queued, running or waiting to retry. A key makes the request once only, such as once a day.
   */
  async schedule(userId: string, key = `profile_index:${userId}:${randomUUID()}`): Promise<void> {
    if (!this.env.GEMINI_API_KEY) return;
    if (await this.hasActiveRun(userId)) return;
    await this.jobs.dispatch({
      userId,
      jobType: 'profile_index',
      idempotencyKey: key,
      input: {},
      maxAttempts: INDEX_MAX_ATTEMPTS,
    });
  }

  private async hasActiveRun(userId: string): Promise<boolean> {
    const result = await this.db.execute(sql`
      select 1 from public.background_jobs
       where user_id = ${userId} and job_type = 'profile_index'
         and status in ('queued', 'running', 'retry_wait')
       limit 1`);
    // node-postgres and PGlite both answer with { rows }.
    return (result as unknown as { rows: unknown[] }).rows.length > 0;
  }
}
