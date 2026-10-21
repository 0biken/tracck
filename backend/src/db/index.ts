import { drizzle } from 'drizzle-orm/node-postgres';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type pg from 'pg';
import * as schema from './schema';

export { schema };

/**
 * Typed queries over PostgreSQL. Written against the shared base type so the
 * same code runs on a node-postgres pool in production and on PGlite in tests.
 */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

/** Typed query access over an existing pool, so the job store and Drizzle share connections. */
export function createDb(pool: pg.Pool): Database {
  return drizzle(pool, { schema });
}
