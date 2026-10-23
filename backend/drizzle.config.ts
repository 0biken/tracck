import { defineConfig } from 'drizzle-kit';

// `pnpm db:generate` writes a migration from src/db/schema.ts, `pnpm db:migrate`
// applies the pending ones to DATABASE_URL.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
  // Supabase owns the auth, storage and extensions schemas; only public is ours.
  schemaFilter: ['public'],
  entities: { roles: { provider: 'supabase' } },
});
