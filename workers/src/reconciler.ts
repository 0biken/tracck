// Brings Redis back in line with PostgreSQL (§7.3, §11 "Redis outage", "Worker crash").
//
// PostgreSQL is the source of truth. If a waiting job has no queue entry (a
// failed enqueue, or Redis lost its data) it is enqueued again. If a running
// job's worker went silent, the job is taken back and retried or failed.

import {
  QUEUE_SCHEMA_VERSION,
  type JobQueue,
  type JobRecord,
  type JobStore,
  type QueueMessage,
} from '@tracck/shared';

export interface ReconcilerDeps {
  store: JobStore;
  queue: JobQueue;
  notify(jobId: string): Promise<void>;
  /** How long a job may wait before we check that Redis still holds it. */
  staleWaitingSeconds?: number;
  /** How long a running job may go without a heartbeat. Keep well above the heartbeat interval. */
  staleRunningSeconds?: number;
  limit?: number;
}

function toMessage(job: JobRecord): QueueMessage {
  return { jobId: job.id, userId: job.userId, type: job.jobType, schemaVersion: QUEUE_SCHEMA_VERSION };
}

export async function reconcile(deps: ReconcilerDeps): Promise<{ requeued: number; recovered: number }> {
  const { store, queue } = deps;
  const staleWaitingSeconds = deps.staleWaitingSeconds ?? 60;
  const staleRunningSeconds = deps.staleRunningSeconds ?? 60;
  const limit = deps.limit ?? 100;
  let requeued = 0;
  let recovered = 0;

  for (const job of await store.findStaleRunning(staleRunningSeconds, limit)) {
    const updated = await store.recoverStaleRunning(job.id, staleRunningSeconds);
    if (!updated) continue;
    recovered += 1;
    if (updated.status === 'retry_wait') {
      await queue.enqueue(toMessage(updated), updated.attemptCount + 1);
    }
    await deps.notify(job.id).catch(() => {});
  }

  for (const job of await store.findStaleWaiting(staleWaitingSeconds, limit)) {
    const nextAttempt = job.attemptCount + 1;
    if (await queue.has(job.id, nextAttempt)) continue;
    await queue.enqueue(toMessage(job), nextAttempt);
    requeued += 1;
  }

  return { requeued, recovered };
}
