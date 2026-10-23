// Loads the starter few-shot examples into resume_examples. Safe to run again: a role
// that already has a synthetic starter row is skipped.
//
//   npm run ai:seed

import pg from 'pg';
import { ROLE_IDS } from '@tracck/shared';
import { EXAMPLE_SEEDS } from './examples-seed';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set. See .env.example.');

const pool = new pg.Pool({ connectionString: url, max: 1 });
try {
  for (const role of ROLE_IDS) {
    const { rowCount } = await pool.query(
      `select 1 from public.resume_examples where role_family = $1 and seniority = 'all' and rights_status = 'synthetic' limit 1`,
      [role],
    );
    if (rowCount) {
      console.log(`${role}: already seeded`);
      continue;
    }
    const seed = EXAMPLE_SEEDS[role];
    await pool.query(
      `insert into public.resume_examples (role_family, seniority, example_kind, example_content_json, rights_status)
       values ($1, 'all', 'good', $2::jsonb, 'synthetic'), ($1, 'all', 'annotated_bad', $3::jsonb, 'synthetic')`,
      [role, JSON.stringify(seed.good), JSON.stringify({ rewrites: seed.rewrites })],
    );
    console.log(`${role}: seeded`);
  }
} finally {
  await pool.end();
}
