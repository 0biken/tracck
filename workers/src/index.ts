import { Worker } from 'bullmq';
import pg from 'pg';
import { JobStore, QUEUE_NAME, jobEventsChannel, type QueueMessage } from '@tracck/shared';
import { BullJobQueue, createRedis } from './bullmq';
import { loadEnv } from './env';
import { diagnostic } from './handlers/diagnostic';
import { reconcile } from './reconciler';
import { runJob, type RunnerDeps } from './runner';

const env = loadEnv();

function log(message: string, fields: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ time: new Date().toISOString(), service: 'worker', message, ...fields }));
}

const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
const redis = createRedis(env.REDIS_URL);
const publisher = createRedis(env.REDIS_URL);
const queue = new BullJobQueue(redis);
const store = new JobStore(pool);

const notify = async (jobId: string) => {
  await publisher.publish(jobEventsChannel(jobId), '1');
};

const deps: RunnerDeps = {
  store,
  queue,
  notify,
  log,
  handlers: { diagnostic },
};

const worker = new Worker<QueueMessage>(
  QUEUE_NAME,
  async (delivery) => {
    const outcome = await runJob(deps, delivery.data);
    log('job delivery handled', { jobId: delivery.data.jobId, jobType: delivery.data.type, outcome });
  },
  { connection: createRedis(env.REDIS_URL), concurrency: env.WORKER_CONCURRENCY },
);

worker.on('error', (error) => log('worker error', { errorName: error.name, errorMessage: error.message }));

const reconcileTimer = setInterval(() => {
  reconcile({ store, queue, notify })
    .then((result) => {
      if (result.requeued || result.recovered) log('reconciled jobs', result);
    })
    .catch((error: Error) => log('reconcile failed', { errorName: error.name, errorMessage: error.message }));
}, env.RECONCILE_INTERVAL_SECONDS * 1000);

log('worker started', { concurrency: env.WORKER_CONCURRENCY });

async function shutdown(signal: string) {
  log('worker stopping', { signal });
  clearInterval(reconcileTimer);
  await worker.close();
  await queue.close();
  redis.disconnect();
  publisher.disconnect();
  await pool.end();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
