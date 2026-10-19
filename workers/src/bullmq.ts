// BullMQ adapter for the JobQueue contract from @tracck/shared.

import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { QUEUE_NAME, queueEntryId, type JobQueue, type QueueMessage } from '@tracck/shared';

/** BullMQ requires `maxRetriesPerRequest: null` on connections it blocks on. */
export function createRedis(url: string): Redis {
  return new Redis(url, { maxRetriesPerRequest: null });
}

export class BullJobQueue implements JobQueue {
  readonly queue: Queue<QueueMessage>;

  constructor(connection: Redis) {
    this.queue = new Queue<QueueMessage>(QUEUE_NAME, { connection });
  }

  async enqueue(message: QueueMessage, attempt: number, delayMs = 0): Promise<void> {
    await this.queue.add(message.type, message, {
      jobId: queueEntryId(message.jobId, attempt),
      delay: delayMs,
      // Retries are decided from PostgreSQL state, so BullMQ runs each entry once.
      attempts: 1,
      removeOnComplete: true,
      removeOnFail: true,
    });
  }

  async has(jobId: string, attempt: number): Promise<boolean> {
    return (await this.queue.getJob(queueEntryId(jobId, attempt))) !== undefined;
  }

  close(): Promise<void> {
    return this.queue.close();
  }
}
