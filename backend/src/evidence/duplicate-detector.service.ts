import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { Database } from '../db';
import { DB } from '../tokens';

const MAX_COMPARED = 400;
const SIMILAR = 0.72;

const tokens = (text: string) =>
  new Set(text.toLowerCase().split(/[^a-z0-9+#.]+/).filter((word) => word.length > 2));

function similarity(a: Set<string>, b: Set<string>) {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const word of a) if (b.has(word)) shared += 1;
  return shared / (a.size + b.size - shared);
}

/**
 * Finds entries from different sources that say the same thing (a CV line and a
 * LinkedIn line, say). It only flags pairs: the person decides whether to merge.
 */
@Injectable()
export class DuplicateDetector {
  constructor(@Inject(DB) private readonly db: Database) {}

  async detect(userId: string): Promise<number> {
    const rows = (
      (await this.db.execute(sql`
        select id, claim_text as text, source_provider as provider
          from public.candidate_evidence
         where user_id = ${userId} and not excluded
         order by created_at desc limit ${MAX_COMPARED}`)) as unknown as { rows: { id: string; text: string; provider: string | null }[] }
    ).rows;

    const prepared = rows.map((row) => ({ ...row, words: tokens(row.text) }));
    let found = 0;
    for (let i = 0; i < prepared.length; i++) {
      for (let j = i + 1; j < prepared.length; j++) {
        const a = prepared[i];
        const b = prepared[j];
        // The same source repeating itself is not a duplicate across sources.
        if (a.provider === b.provider) continue;
        if (similarity(a.words, b.words) < SIMILAR) continue;
        const [from, to] = a.id < b.id ? [a.id, b.id] : [b.id, a.id];
        const result = (await this.db.execute(sql`
          insert into public.evidence_relations (user_id, from_evidence_id, relation_type, to_evidence_id)
          select ${userId}, ${from}, 'possible_duplicate', ${to}
           where not exists (
             select 1 from public.evidence_relations
              where relation_type = 'possible_duplicate'
                and ((from_evidence_id = ${from} and to_evidence_id = ${to}) or (from_evidence_id = ${to} and to_evidence_id = ${from})))
          on conflict do nothing
          returning id`)) as unknown as { rows: unknown[] };
        found += result.rows.length;
      }
    }
    return found;
  }
}
