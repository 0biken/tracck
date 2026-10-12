import pg from 'pg';
import { JobStore } from '@tracck/core';
import { BullJobQueue, createRedis } from '@tracck/core/bullmq';
import { buildApp } from './app';
import { createTokenVerifier } from './auth';
import { loadEnv } from './env';
import { createRedisJobEvents } from './events';

const env = loadEnv();

const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
const redis = createRedis(env.REDIS_URL);
const subscriber = createRedis(env.REDIS_URL);
const queue = new BullJobQueue(redis);

const app = await buildApp({
  store: new JobStore(pool),
  queue,
  events: createRedisJobEvents(subscriber),
  verifyToken: createTokenVerifier({ supabaseUrl: env.SUPABASE_URL, jwtSecret: env.SUPABASE_JWT_SECRET }),
  appOrigin: env.APP_ORIGIN,
  enableDiagnosticJobs: env.ENABLE_DIAGNOSTIC_JOBS === 'true',
  logger: true,
});

await app.listen({ port: env.PORT, host: '0.0.0.0' });

async function shutdown() {
  await app.close();
  await queue.close();
  redis.disconnect();
  subscriber.disconnect();
  await pool.end();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
