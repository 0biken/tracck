// Applies supabase/migrations/*.sql in order, recording each in the same table the
// Supabase CLI uses (supabase_migrations.schema_migrations), so either tool can
// carry on from where the other stopped.
//
//   npm run db:migrate

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const MIGRATIONS_DIR = fileURLToPath(new URL('../../../supabase/migrations/', import.meta.url));

// Only the database URL is needed, so the rest of the API's environment can be unset.
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL is not set. See .env.example.');

const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 1 });

try {
  await pool.query(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key,
      statements text[],
      name text
    );
  `);
  const { rows } = await pool.query<{ version: string }>('select version from supabase_migrations.schema_migrations');
  const applied = new Set(rows.map((row) => row.version));

  for (const file of readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith('.sql')).sort()) {
    const [version, ...rest] = file.replace(/\.sql$/, '').split('_');
    if (applied.has(version)) continue;

    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(readFileSync(`${MIGRATIONS_DIR}${file}`, 'utf8'));
      await client.query(
        'insert into supabase_migrations.schema_migrations (version, name) values ($1, $2)',
        [version, rest.join('_')],
      );
      await client.query('commit');
      console.log(`applied ${file}`);
    } catch (error) {
      await client.query('rollback');
      throw new Error(`${file} failed: ${error instanceof Error ? error.message : error}`);
    } finally {
      client.release();
    }
  }
  console.log('database is up to date');
} finally {
  await pool.end();
}
