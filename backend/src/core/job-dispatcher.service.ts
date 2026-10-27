import { Inject, Injectable } from '@nestjs/common';
import {
  QUEUE_SCHEMA_VERSION,
  type JobQueue,
  type JobRecord,
  type JobStore,
  type JobType,
} from '@tracck/shared';
import { JOB_QUEUE, JOB_STORE } from '../tokens';

export interface DispatchInput {
  userId: string;
  jobType: JobType;
  /** The same key never makes a second job. */
  idempotencyKey: string;
  /** Small references only (IDs), never document contents. */
  input: Record<string, unknown>;
  correlationId?: string;
  /** Attempts before the job fails for good. Retries back off exponentially. Defaults to 3. */
  maxAttempts?: number;
}

export interface JobHandle {
  job: JobRecord;
  created: boolean;
}

/**
 * Makes a job durable in PostgreSQL, then puts it on the queue. If the queue is
 * down the job is still safe: the reconciler enqueues it later. Every feature that
 * starts background work goes through here.
 */
@Injectable()
export class JobDispatcher {
  constructor(
    @Inject(JOB_STORE) private readonly store: JobStore,
    @Inject(JOB_QUEUE) private readonly queue: JobQueue,
  ) {}

  async dispatch(input: DispatchInput): Promise<JobHandle> {
    const { job, created } = await this.store.create({
      userId: input.userId,
      jobType: input.jobType,
      idempotencyKey: input.idempotencyKey,
      inputRef: input.input,
      correlationId: input.correlationId,
      maxAttempts: input.maxAttempts,
    });
    if (created) await this.enqueue(job);
    return { job, created };
  }

  /** Puts an existing job (new, or retried) on the queue. */
  async enqueue(job: JobRecord): Promise<void> {
    try {
      await this.queue.enqueue(
        { jobId: job.id, userId: job.userId, type: job.jobType, schemaVersion: QUEUE_SCHEMA_VERSION },
        job.attemptCount + 1,
      );
    } catch (error) {
      await this.store.recordEnqueueError(job.id, String(error)).catch(() => {});
    }
  }

  statusUrls(jobId: string) {
    return { statusUrl: `/v1/jobs/${jobId}`, eventsUrl: `/v1/jobs/${jobId}/events` };
  }
}
