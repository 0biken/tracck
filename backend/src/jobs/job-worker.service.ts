import {
  Inject,
  Injectable,
  Logger,
  type BeforeApplicationShutdown,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import type { JobQueue, JobStore } from '@tracck/shared';
import type { ApiEnv } from '../config/env';
import { ENV, JOB_HANDLERS, JOB_QUEUE, JOB_STORE, NOTIFY_JOB } from '../tokens';
import type { RunnerDeps } from './runner';
import { startJobWorker } from './worker';

/**
 * Starts the BullMQ worker with the app and stops it on shutdown, letting jobs
 * that are running finish first. `RUN_JOB_WORKER=false` makes an API-only instance.
 */
@Injectable()
export class JobWorkerService implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private readonly logger = new Logger('Jobs');
  private worker?: { close(): Promise<void> };

  constructor(
    @Inject(ENV) private readonly env: ApiEnv,
    @Inject(JOB_STORE) private readonly store: JobStore,
    @Inject(JOB_QUEUE) private readonly queue: JobQueue,
    @Inject(NOTIFY_JOB) private readonly notify: (jobId: string) => Promise<void>,
    @Inject(JOB_HANDLERS) private readonly handlers: RunnerDeps['handlers'],
  ) {}

  onApplicationBootstrap() {
    if (this.env.RUN_JOB_WORKER !== 'true') {
      this.logger.log('job worker disabled (RUN_JOB_WORKER=false)');
      return;
    }
    this.worker = startJobWorker({
      store: this.store,
      queue: this.queue,
      handlers: this.handlers,
      notify: this.notify,
      redisUrl: this.env.REDIS_URL,
      concurrency: this.env.WORKER_CONCURRENCY,
      reconcileIntervalSeconds: this.env.RECONCILE_INTERVAL_SECONDS,
      log: (message, fields) => this.logger.log(`${message} ${JSON.stringify(fields)}`),
    });
  }

  async beforeApplicationShutdown() {
    await this.worker?.close();
  }
}
