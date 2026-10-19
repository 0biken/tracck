// Queue contract (§4.5). Messages carry identifiers only: never a CV, a token
// or a prompt. Workers load the authoritative input from PostgreSQL.

import type { JobType } from './jobs';

export const QUEUE_NAME = 'tracck-jobs';
export const QUEUE_SCHEMA_VERSION = 1;

export interface QueueMessage {
  jobId: string;
  userId: string;
  type: JobType;
  schemaVersion: number;
}

export interface JobQueue {
  /** `attempt` is the attempt this delivery will run. Enqueueing the same pair twice is a no-op. */
  enqueue(message: QueueMessage, attempt: number, delayMs?: number): Promise<void>;
  has(jobId: string, attempt: number): Promise<boolean>;
}

/** One queue entry per job attempt, so a redelivery never collides with a retry. */
export function queueEntryId(jobId: string, attempt: number): string {
  return `${jobId}_${attempt}`;
}

/** Redis pub/sub channel that tells API instances a job row changed. Disposable transport. */
export function jobEventsChannel(jobId: string): string {
  return `job-events:${jobId}`;
}
