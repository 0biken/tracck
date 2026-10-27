// Builds the real Nest app on in-memory stand-ins for PostgreSQL (PGlite, with the
// real migrations) and Redis, so module tests exercise the same SQL and the same
// request pipeline as production.

import 'reflect-metadata';
import { Global, Module, type INestApplication } from '@nestjs/common';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import { drizzle } from 'drizzle-orm/pglite';
import request from 'supertest';
import { ApiError, JobStore } from '@tracck/shared';
import { AppModule } from '../app.module';
import { configureApp } from '../app.setup';
import type { ApiEnv } from '../config/env';
import { ConnectionsModule } from '../connections/connections.module';
import * as schema from '../db/schema';
import { FakeJobQueue, createTestDatabase, createTestUser, type PGlite } from '../testing';
import { MemoryRateLimiter } from '../connections/rate-limiter';
import { runJob, type RunOutcome, type RunnerDeps } from '../jobs/runner';
import { MemoryStorage } from '../storage/storage';
import { MemoryEmail } from '../email/email';
import { FakeGithub, FakePaystack, FakeSafeFetch } from './fakes';
import {
  DB,
  ENV,
  JOB_EVENTS,
  JOB_QUEUE,
  JOB_STORE,
  NOTIFY_JOB,
  EMAIL,
  GITHUB,
  PAYSTACK,
  JOB_HANDLERS,
  RATE_LIMITER,
  SAFE_FETCH,
  STORAGE,
  STREAM_POLL_MS,
  VERIFY_TOKEN,
} from '../tokens';

export const TEST_ORIGIN = 'http://localhost:3000';

export interface TestApp {
  app: INestApplication;
  db: PGlite;
  store: JobStore;
  queue: FakeJobQueue;
  /** A supertest agent on the app. */
  http: () => ReturnType<typeof request>;
  /** The Authorization header for a user. */
  as: (userId: string) => { authorization: string };
  newUser: (name?: string) => Promise<string>;
  /** Job-change notifications the app sent. */
  notified: string[];
  storage: MemoryStorage;
  github: FakeGithub;
  safeFetch: FakeSafeFetch;
  paystack: FakePaystack;
  /** Mail the app sent. Only present when the test asked for email with `email: true`. */
  email: MemoryEmail;
  /** Runs every queued job through the real runner and handlers, until none are left. */
  drain: () => Promise<RunOutcome[]>;
  close: () => Promise<void>;
}

export interface TestAppOptions {
  env?: Partial<ApiEnv>;
  /** Turns email on, into `email.sent`. Off by default so other tests see no extra jobs. */
  email?: boolean;
  /** Replace more providers, for example the email or storage client. */
  override?: (builder: TestingModuleBuilder) => TestingModuleBuilder;
}

export async function createTestApp(options: TestAppOptions = {}): Promise<TestApp> {
  const db = await createTestDatabase();
  const store = new JobStore(db);
  const queue = new FakeJobQueue();
  const notified: string[] = [];
  const storage = new MemoryStorage();
  const github = new FakeGithub();
  const safeFetch = new FakeSafeFetch();
  const paystack = new FakePaystack();
  const email = new MemoryEmail();

  const env: ApiEnv = {
    PORT: 0,
    DATABASE_URL: 'unused',
    REDIS_URL: 'unused',
    SUPABASE_URL: 'https://example.supabase.co',
    APP_ORIGIN: TEST_ORIGIN,
    ENABLE_DIAGNOSTIC_JOBS: 'true',
    DISABLE_PAYMENT_RESTRICTIONS: 'false',
    RUN_JOB_WORKER: 'false',
    WORKER_CONCURRENCY: 1,
    RECONCILE_INTERVAL_SECONDS: 30,
    STORAGE_BUCKET: 'test-bucket',
    // 32 bytes, base64: the key that encrypts stored tokens.
    TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
    API_PUBLIC_URL: 'http://localhost:4000',
    PAYSTACK_SECRET_KEY: 'sk_test_secret',
    PAYSTACK_PRO_PLAN_CODE: 'PLN_pro',
    ...options.env,
  };

  const providers = [
    { provide: DB, useValue: drizzle(db, { schema }) },
    { provide: JOB_STORE, useValue: store },
    { provide: JOB_QUEUE, useValue: queue },
    { provide: JOB_EVENTS, useValue: { subscribe: () => () => {} } },
    { provide: RATE_LIMITER, useValue: new MemoryRateLimiter() },
    {
      provide: NOTIFY_JOB,
      useValue: async (jobId: string) => {
        notified.push(jobId);
      },
    },
  ];

  @Global()
  @Module({ providers, exports: providers.map((provider) => provider.provide) })
  class FakeConnectionsModule {}

  let builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideModule(ConnectionsModule)
    .useModule(FakeConnectionsModule)
    .overrideProvider(ENV)
    .useValue(env)
    // Tokens in tests are simply "token-<userId>".
    .overrideProvider(VERIFY_TOKEN)
    .useValue(async (token: string) => {
      if (!token.startsWith('token-')) throw new ApiError(401, 'UNAUTHORIZED', 'Sign in to continue.');
      const userId = token.slice('token-'.length);
      return { userId, email: `${userId}@example.com` };
    })
    .overrideProvider(STREAM_POLL_MS)
    .useValue(50)
    .overrideProvider(STORAGE)
    .useValue(storage)
    .overrideProvider(GITHUB)
    .useValue(github)
    .overrideProvider(SAFE_FETCH)
    .useValue(safeFetch)
    .overrideProvider(PAYSTACK)
    .useValue(paystack);

  if (options.email) builder = builder.overrideProvider(EMAIL).useValue(email);

  if (options.override) builder = options.override(builder);

  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication({ rawBody: true });
  configureApp(app, { appOrigin: env.APP_ORIGIN });
  await app.init();

  const drain = async () => {
    const deps: RunnerDeps = {
      store,
      queue,
      notify: async (jobId) => {
        notified.push(jobId);
      },
      handlers: app.get(JOB_HANDLERS, { strict: false }),
      heartbeatMs: 60_000,
    };
    const outcomes: RunOutcome[] = [];
    for (let guard = 0; guard < 50 && queue.entries.size > 0; guard++) {
      const [id, entry] = [...queue.entries.entries()][0];
      queue.entries.delete(id);
      outcomes.push(await runJob(deps, entry.message));
    }
    return outcomes;
  };

  return {
    app,
    db,
    store,
    queue,
    notified,
    storage,
    github,
    safeFetch,
    paystack,
    email,
    drain,
    http: () => request(app.getHttpServer()),
    as: (userId) => ({ authorization: `Bearer token-${userId}` }),
    newUser: (name) => createTestUser(db, name),
    close: async () => {
      await app.close();
      await db.close();
    },
  };
}
