import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { processClaimClassification } from './jobs/claim-classification';
import { processBulletGeneration } from './jobs/bullet-generation';
import { processJdParsing } from './jobs/jd-parsing';
import { processRoleScoring } from './jobs/role-scoring';
import { processResumeBuild } from './jobs/resume-build';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const redisConnection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

console.log('Background workers starting up...');

const _socialFetchWorker = new Worker(
  'social-fetch',
  async (job) => {
    console.log(`[social-fetch] Processing job ${job.id}`);
  },
  { connection: redisConnection }
);

const _aiExtractionWorker = new Worker(
  'ai-extraction',
  async (job) => {
    if (job.name === 'claim-classification') {
      return processClaimClassification(job);
    } else if (job.name === 'bullet-generation') {
      return processBulletGeneration(job);
    } else if (job.name === 'jd-parsing') {
      return processJdParsing(job);
    }
  },
  { connection: redisConnection }
);

const _resumeBuildWorker = new Worker(
  'resume-build',
  async (job) => {
    if (job.name === 'resume-build') {
      return processResumeBuild(job);
    }
  },
  { connection: redisConnection }
);

const _atsScoreWorker = new Worker(
  'ats-score',
  async (job) => {
    if (job.name === 'role-scoring') {
      return processRoleScoring(job);
    }
  },
  { connection: redisConnection }
);

console.log('Workers registered and listening to queues.');
