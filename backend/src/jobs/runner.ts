// Runs one queue delivery against durable job state (§7.3).
//
// Safe to call more than once for the same job: a delivery that cannot claim
// the job is dropped, and every update names the attempt that was claimed.

import {
  JobError,
  backoffMs,
  hasAttemptsLeft,
  type JobQueue,
  type JobRecord,
  type JobStep,
  type JobStore,
  type JobType,
  type QueueMessage,
} from '@tracck/shared';

export interface JobContext {
  job: JobRecord;
  /**
   * Persists the step the job is on. Throws to stop the handler if the user
   * asked to cancel or the job was taken over, so call it between expensive steps.
   */
  setStep(step: JobStep, progressPercent?: number): Promise<void>;
}

/** Returns a small reference to the result. Large results belong in their own tables. */
export type JobHandler = (ctx: JobContext) => Promise<Record<string, unknown>>;

export type RunOutcome =
  | 'succeeded'
  | 'failed'
  | 'retry_scheduled'
  | 'cancelled'
  | 'needs_user_action'
  | 'skipped';

export interface RunnerDeps {
  store: JobStore;
  queue: JobQueue;
  handlers: Partial<Record<JobType, JobHandler>>;
  /** Tells listeners the job row changed. Best effort: a lost message must not matter. */
  notify(jobId: string): Promise<void>;
  heartbeatMs?: number;
  backoff?: (attempt: number) => number;
  log?: (message: string, fields: Record<string, unknown>) => void;
}

class CancelRequested extends Error {}
class JobTakenOver extends Error {}

const UNEXPECTED = new JobError(
  'retryable',
  'INTERNAL_ERROR',
  'Something went wrong while running this job.',
);

export async function runJob(deps: RunnerDeps, message: QueueMessage): Promise<RunOutcome> {
  const { store, queue } = deps;
  const log = deps.log ?? (() => {});
  const notify = () => deps.notify(message.jobId).catch(() => {});

  const job = await store.markRunning(message.jobId);
  if (!job) return 'skipped';
  const attempt = job.attemptCount;
  await notify();

  const heartbeat = setInterval(() => {
    store.heartbeat(job.id, attempt).catch(() => {});
  }, deps.heartbeatMs ?? 10_000);
  heartbeat.unref?.();

  try {
    const handler = deps.handlers[job.jobType];
    if (!handler) {
      throw new JobError('permanent', 'UNSUPPORTED_JOB_TYPE', 'This kind of job is not available yet.');
    }

    const result = await handler({
      job,
      async setStep(step, progressPercent) {
        const updated = await store.setStep(job.id, attempt, step, progressPercent ?? null);
        if (!updated) throw new JobTakenOver();
        await notify();
        if (updated.cancelRequestedAt) throw new CancelRequested();
      },
    });

    return (await store.succeed(job.id, attempt, result)) ? 'succeeded' : 'skipped';
  } catch (caught) {
    if (caught instanceof JobTakenOver) return 'skipped';
    if (caught instanceof CancelRequested) {
      return (await store.cancelRunning(job.id, attempt)) ? 'cancelled' : 'skipped';
    }

    const error = caught instanceof JobError ? caught : UNEXPECTED;
    // The safe message is the only text stored. The raw error may hold private content.
    log('job attempt failed', {
      jobId: job.id,
      jobType: job.jobType,
      attempt,
      errorCode: error.code,
      errorName: caught instanceof Error ? caught.name : typeof caught,
    });

    if (error.kind === 'needs_user_action') {
      const updated = await store.needsUserAction(job.id, attempt, error.code, error.safeMessage);
      return updated ? 'needs_user_action' : 'skipped';
    }

    if (error.kind === 'permanent' || !hasAttemptsLeft(attempt, job.maxAttempts)) {
      return (await store.fail(job.id, attempt, error.code, error.safeMessage)) ? 'failed' : 'skipped';
    }

    if (!(await store.scheduleRetry(job.id, attempt, error.code, error.safeMessage))) return 'skipped';
    const delayMs = Math.max((deps.backoff ?? backoffMs)(attempt), error.retryAfterMs ?? 0);
    try {
      await queue.enqueue(message, attempt + 1, delayMs);
    } catch (enqueueError) {
      // The job stays in retry_wait. The reconciler will put it back on the queue.
      await store.recordEnqueueError(job.id, String(enqueueError)).catch(() => {});
    }
    return 'retry_scheduled';
  } finally {
    clearInterval(heartbeat);
    await notify();
  }
}
