// Runs queued jobs inside the API process: a BullMQ Worker that hands each
// delivery to the runner, plus a timer that recovers jobs the queue lost.

import { Worker } from 'bullmq';
import { QUEUE_NAME, type JobQueue, type JobStore, type QueueMessage } from '@tracck/shared';
import { createRedis } from '../connections/bullmq';
import { reconcile } from './reconciler';
import { runJob, type JobHandler, type RunnerDeps } from './runner';

export interface JobWorkerOptions {
  store: JobStore;
  queue: JobQueue;
  handlers: RunnerDeps['handlers'];
  /** Tells listeners the job row changed. */
  notify(jobId: string): Promise<void>;
  redisUrl: string;
  /** How many jobs run at once. */
  concurrency: number;
  /** How often to look for queued jobs that lost their queue entry, and for runs that went silent. */
  reconcileIntervalSeconds: number;
  log: (message: string, fields: Record<string, unknown>) => void;
}

export type { JobHandler };

export function startJobWorker(options: JobWorkerOptions) {
  const { store, queue, handlers, notify, log } = options;
  const deps: RunnerDeps = { store, queue, handlers, notify, log };

  // A BullMQ worker blocks on its connection, so it gets one of its own.
  const connection = createRedis(options.redisUrl);

  const worker = new Worker<QueueMessage>(
    QUEUE_NAME,
    async (delivery) => {
      const outcome = await runJob(deps, delivery.data);
      log('job delivery handled', { jobId: delivery.data.jobId, jobType: delivery.data.type, outcome });
    },
    { connection, concurrency: options.concurrency },
  );

  worker.on('error', (error) => log('job worker error', { errorName: error.name, errorMessage: error.message }));

  const reconcileTimer = setInterval(() => {
    reconcile({ store, queue, notify })
      .then((result) => {
        if (result.requeued || result.recovered) log('reconciled jobs', result);
      })
      .catch((error: Error) => log('reconcile failed', { errorName: error.name, errorMessage: error.message }));
  }, options.reconcileIntervalSeconds * 1000);

  log('job worker started', { concurrency: options.concurrency, jobTypes: Object.keys(handlers) });

  return {
    /** Stops taking new jobs and waits for the ones running now to finish. */
    async close() {
      clearInterval(reconcileTimer);
      await worker.close();
      connection.disconnect();
    },
  };
}
