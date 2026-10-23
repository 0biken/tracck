// Test helpers. An in-process PostgreSQL (PGlite) runs the real drizzle migrations, so
// tests exercise the same SQL that production does.

import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { queueEntryId, type JobQueue, type QueueMessage } from '@tracck/shared';

export type { PGlite };

const MIGRATIONS_DIR = fileURLToPath(new URL('../drizzle', import.meta.url));

// The parts of a Supabase project the migrations rely on.
const SUPABASE_STUB = `
  create schema extensions;
  create schema auth;
  create role anon nologin;
  create role authenticated nologin;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb not null default '{}'
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema public, auth, extensions to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
`;

export async function createTestDatabase(): Promise<PGlite> {
  const db = await PGlite.create({ extensions: { vector } });
  await db.exec(SUPABASE_STUB);
  await migrate(drizzle(db), { migrationsFolder: MIGRATIONS_DIR });
  return db;
}

/** Inserts an auth user. The signup trigger creates the matching profile. */
export async function createTestUser(db: PGlite, fullName = 'Test User'): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `insert into auth.users (email, raw_user_meta_data) values ($1, $2::jsonb) returning id`,
    [`${crypto.randomUUID()}@example.com`, JSON.stringify({ full_name: fullName })],
  );
  return rows[0].id;
}

/** Runs `fn` the way a signed-in browser would reach the database: as `authenticated`, under RLS. */
export async function asBrowserUser<T>(db: PGlite, userId: string, fn: () => Promise<T>): Promise<T> {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId]);
  await db.exec(`set role authenticated`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role`);
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  }
}

export class FakeJobQueue implements JobQueue {
  readonly entries = new Map<string, { message: QueueMessage; attempt: number; delayMs: number }>();
  failNextEnqueue = false;

  async enqueue(message: QueueMessage, attempt: number, delayMs = 0): Promise<void> {
    if (this.failNextEnqueue) {
      this.failNextEnqueue = false;
      throw new Error('Redis is unavailable');
    }
    const id = queueEntryId(message.jobId, attempt);
    if (!this.entries.has(id)) this.entries.set(id, { message, attempt, delayMs });
  }

  async has(jobId: string, attempt: number): Promise<boolean> {
    return this.entries.has(queueEntryId(jobId, attempt));
  }
}
