import { Global, Inject, Injectable, Logger, Module, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import type { Redis } from 'ioredis';
import pg from 'pg';
import { JobStore, jobEventsChannel } from '@tracck/shared';
import type { ApiEnv } from '../config/env';
import { createDb } from '../db';
import {
  DB,
  ENV,
  JOB_EVENTS,
  JOB_QUEUE,
  JOB_STORE,
  NOTIFY_JOB,
  PG_POOL,
  PUBLISHER_REDIS,
  QUEUE_REDIS,
  RATE_LIMITER,
  SUBSCRIBER_REDIS,
} from '../tokens';
import { BullJobQueue, createRedis } from './bullmq';
import { createRedisJobEvents } from './job-events';
import { createRedisRateLimiter } from './rate-limiter';

/**
 * Background jobs are only safe when Redis never evicts keys: under memory pressure an evicted job
 * key is a job that silently never runs. Says so at startup, so the setting is visible in the logs.
 */
@Injectable()
class RedisPolicyCheck implements OnApplicationBootstrap {
  private readonly logger = new Logger('Redis');

  constructor(@Inject(QUEUE_REDIS) private readonly redis: Redis) {}

  async onApplicationBootstrap() {
    try {
      const [, policy] = (await this.redis.config('GET', 'maxmemory-policy')) as string[];
      if (policy === 'noeviction') {
        this.logger.log('Redis eviction policy is noeviction');
      } else {
        this.logger.warn(`Redis eviction policy is ${policy}. Set maxmemory-policy to noeviction so queued jobs are never evicted.`);
      }
    } catch {
      // Some hosted Redis services do not allow reading the configuration. Say so, and carry on.
      this.logger.warn('Could not read the Redis eviction policy. Check it is noeviction on your Redis host.');
    }
  }
}

/** Closes every connection when the app stops, after the job worker has finished its jobs. */
@Injectable()
class ConnectionsShutdown implements OnApplicationShutdown {
  constructor(
    @Inject(PG_POOL) private readonly pool: pg.Pool,
    @Inject(JOB_QUEUE) private readonly queue: BullJobQueue,
    @Inject(QUEUE_REDIS) private readonly queueRedis: Redis,
    @Inject(SUBSCRIBER_REDIS) private readonly subscriber: Redis,
    @Inject(PUBLISHER_REDIS) private readonly publisher: Redis,
  ) {}

  async onApplicationShutdown() {
    await this.queue.close();
    this.queueRedis.disconnect();
    this.subscriber.disconnect();
    this.publisher.disconnect();
    await this.pool.end();
  }
}

/**
 * Everything that talks to PostgreSQL or Redis. Redis connections are single
 * purpose: queue writes, live-progress subscriptions for the SSE streams, and
 * publishing "this job changed" from the job runner. Tests replace this whole
 * module with in-memory fakes.
 */
@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ENV],
      useFactory: (env: ApiEnv) => new pg.Pool({ connectionString: env.DATABASE_URL }),
    },
    { provide: DB, inject: [PG_POOL], useFactory: (pool: pg.Pool) => createDb(pool) },
    { provide: QUEUE_REDIS, inject: [ENV], useFactory: (env: ApiEnv) => createRedis(env.REDIS_URL) },
    { provide: SUBSCRIBER_REDIS, inject: [ENV], useFactory: (env: ApiEnv) => createRedis(env.REDIS_URL) },
    { provide: PUBLISHER_REDIS, inject: [ENV], useFactory: (env: ApiEnv) => createRedis(env.REDIS_URL) },
    { provide: RATE_LIMITER, inject: [QUEUE_REDIS], useFactory: (redis: Redis) => createRedisRateLimiter(redis) },
    { provide: JOB_STORE, inject: [PG_POOL], useFactory: (pool: pg.Pool) => new JobStore(pool) },
    { provide: JOB_QUEUE, inject: [QUEUE_REDIS], useFactory: (redis: Redis) => new BullJobQueue(redis) },
    { provide: JOB_EVENTS, inject: [SUBSCRIBER_REDIS], useFactory: (redis: Redis) => createRedisJobEvents(redis) },
    {
      provide: NOTIFY_JOB,
      inject: [PUBLISHER_REDIS],
      useFactory: (publisher: Redis) => async (jobId: string) => {
        await publisher.publish(jobEventsChannel(jobId), '1');
      },
    },
    ConnectionsShutdown,
    RedisPolicyCheck,
  ],
  exports: [DB, JOB_STORE, JOB_QUEUE, JOB_EVENTS, NOTIFY_JOB, RATE_LIMITER],
})
export class ConnectionsModule {}
