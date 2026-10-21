import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import type pg from 'pg';
import * as schema from './schema';

export { schema };

export type Database = NodePgDatabase<typeof schema>;

/** Typed query access over an existing pool, so the job store and Drizzle share connections. */
export function createDb(pool: pg.Pool): Database {
  return drizzle(pool, { schema });
}
