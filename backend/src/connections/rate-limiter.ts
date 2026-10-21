import type { Redis } from 'ioredis';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the window resets. */
  retryAfterSeconds: number;
}

export interface RateLimiter {
  /** Counts one hit against `key` in a fixed window and says whether it is still allowed. */
  hit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult>;
}

function windowOf(windowSeconds: number, now = Date.now()) {
  const size = windowSeconds * 1000;
  const bucket = Math.floor(now / size);
  return { bucket, retryAfterSeconds: Math.max(1, Math.ceil(((bucket + 1) * size - now) / 1000)) };
}

/** Fixed-window limiter on Redis, shared by every instance of the API. */
export function createRedisRateLimiter(redis: Redis): RateLimiter {
  return {
    async hit(key, limit, windowSeconds) {
      const { bucket, retryAfterSeconds } = windowOf(windowSeconds);
      const redisKey = `rl:${key}:${bucket}`;
      const count = await redis.incr(redisKey);
      if (count === 1) await redis.expire(redisKey, windowSeconds + 1);
      return { allowed: count <= limit, remaining: Math.max(0, limit - count), retryAfterSeconds };
    },
  };
}

/** In-process limiter for tests and single-instance development. */
export class MemoryRateLimiter implements RateLimiter {
  private readonly counts = new Map<string, number>();

  async hit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const { bucket, retryAfterSeconds } = windowOf(windowSeconds);
    const memoryKey = `${key}:${bucket}`;
    const count = (this.counts.get(memoryKey) ?? 0) + 1;
    this.counts.set(memoryKey, count);
    return { allowed: count <= limit, remaining: Math.max(0, limit - count), retryAfterSeconds };
  }
}
