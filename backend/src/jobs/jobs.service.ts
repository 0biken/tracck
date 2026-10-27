import { Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  ApiError,
  QUEUE_SCHEMA_VERSION,
  toJobView,
  type JobQueue,
  type JobListItem,
  type JobRecord,
  type JobStatus,
  type JobStep,
  type JobType,
  type JobStore,
} from '@tracck/shared';
import { backgroundJobs } from '../db/schema';
import type { Database } from '../db';
import { DB, JOB_QUEUE, JOB_STORE } from '../tokens';

const jobId = z.uuid();
const diagnosticBody = z.strictObject({ stepDelayMs: z.number().int().min(0).max(5000).optional() });
const idempotencyKey = z.string().min(8).max(200);

function jobUrls(id: string) {
  return { statusUrl: `/v1/jobs/${id}`, eventsUrl: `/v1/jobs/${id}/events` };
}

/**
 * What the API does with jobs. The API only ever writes a job and enqueues it;
 * running it is the job worker's business, so no request waits on slow work.
 */
@Injectable()
export class JobsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(JOB_STORE) private readonly store: JobStore,
    @Inject(JOB_QUEUE) private readonly queue: JobQueue,
  ) {}

  async createDiagnostic(userId: string, rawKey: unknown, rawBody: unknown, correlationId: string) {
    const key = idempotencyKey.safeParse(rawKey);
    if (!key.success) {
      throw new ApiError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Send an Idempotency-Key header with this request.');
    }
    const body = diagnosticBody.parse(rawBody ?? {});

    const { job, created } = await this.store.create({
      userId,
      jobType: 'diagnostic',
      idempotencyKey: key.data,
      inputRef: body,
      correlationId,
    });
    if (created) await this.enqueue(job);

    return { jobId: job.id, ...jobUrls(job.id) };
  }

  /** A missing job and someone else's job get the same answer (§9, "API rules"). */
  async load(userId: string, id: string): Promise<JobRecord> {
    const job = await this.store.getForUser(jobId.parse(id), userId);
    if (!job) throw new ApiError(404, 'NOT_FOUND', 'We could not find that job.');
    return job;
  }

  async view(userId: string, id: string) {
    return toJobView(await this.load(userId, id));
  }

  /** The person's recent background work, newest first: what is running, and what failed and why. */
  async recent(userId: string, limit: number): Promise<JobListItem[]> {
    const rows = await this.db
      .select()
      .from(backgroundJobs)
      .where(eq(backgroundJobs.userId, userId))
      .orderBy(desc(backgroundJobs.createdAt))
      .limit(limit);
    return rows.map((row) => ({
      id: row.id,
      type: row.jobType as JobType,
      status: row.status as JobStatus,
      step: row.step as JobStep | null,
      progressPercent: row.progressPercent,
      attempts: row.attemptCount,
      maxAttempts: row.maxAttempts,
      error: row.errorCode ? { code: row.errorCode, message: row.safeErrorMessage ?? 'This job did not finish.' } : null,
      createdAt: row.createdAt.toISOString(),
      startedAt: row.startedAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
    }));
  }

  async cancel(userId: string, id: string) {
    const job = await this.load(userId, id);
    const updated = await this.store.requestCancel(job.id, userId);
    if (!updated) throw new ApiError(409, 'JOB_NOT_CANCELLABLE', 'This job has already finished.');
    return toJobView(updated);
  }

  async retry(userId: string, id: string) {
    const job = await this.load(userId, id);
    const updated = await this.store.requeueFailed(job.id, userId);
    if (!updated) throw new ApiError(409, 'JOB_NOT_RETRYABLE', 'Only a failed job can be retried.');
    await this.enqueue(updated);
    return toJobView(updated);
  }

  private async enqueue(job: JobRecord): Promise<void> {
    try {
      await this.queue.enqueue(
        { jobId: job.id, userId: job.userId, type: job.jobType, schemaVersion: QUEUE_SCHEMA_VERSION },
        job.attemptCount + 1,
      );
    } catch (error) {
      // The job is already durable. The reconciler will enqueue it later.
      await this.store.recordEnqueueError(job.id, String(error)).catch(() => {});
    }
  }
}
