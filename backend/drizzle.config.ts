import { defineConfig } from 'drizzle-kit';

// The SQL migrations in supabase/migrations are the source of truth. drizzle-kit is
// used for `db:studio` and `db:check` (compare the live database with schema.ts via
// `drizzle-kit pull`), not to generate migrations.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './.drizzle',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
  schemaFilter: ['public'],
});
