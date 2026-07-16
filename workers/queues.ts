import { Queue } from 'bullmq';
import Redis from 'ioredis';

// Reuse a single Redis connection for all queues to prevent connection limits
const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export const queues = {
  socialFetch: new Queue('social-fetch', { connection: redisConnection }),
  aiExtraction: new Queue('ai-extraction', { connection: redisConnection }),
  resumeBuild: new Queue('resume-build', { connection: redisConnection }),
  notification: new Queue('notification', { connection: redisConnection }),
  atsScore: new Queue('ats-score', { connection: redisConnection }),
};
