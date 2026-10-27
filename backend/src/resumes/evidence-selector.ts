import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { EvidenceCandidate, JobReading } from '../ai/ai-engine';
import { ContextService } from '../ai/context.service';
import type { AiSettings } from '../ai/ai.config';
import { EmbeddingSyncService } from '../ai/embedding-sync.service';
import type { ApiEnv } from '../config/env';
import type { Database } from '../db';
import { AI_SETTINGS, DB, ENV } from '../tokens';

const SOURCE_LABEL: Record<string, EvidenceCandidate['source']> = {
  github: 'GITHUB',
  cv: 'CV',
  linkedin: 'LINKEDIN',
  portfolio: 'PORTFOLIO',
  x: 'X',
  manual: 'MANUAL',
};

const pgArray = (values: string[]) => `{${values.map((value) => `"${value.replace(/["\\]/g, (char) => `\\${char}`)}"`).join(',')}}`;

/**
 * Chooses the entries a resume is written from. With the AI engine configured this is
 * the engine's own retrieval (meaning, wording and tags, fused). Without it, a plain
 * ranking: pinned first, then the entries that name the skills the job asks for.
 */
@Injectable()
export class EvidenceSelector {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
    @Inject(ContextService) private readonly context: ContextService,
    @Inject(EmbeddingSyncService) private readonly embeddings: EmbeddingSyncService,
    @Inject(AI_SETTINGS) private readonly settings: AiSettings,
  ) {}

  async select(input: {
    userId: string;
    description: string;
    reading: JobReading;
    providers: string[];
    focus: string | null;
  }): Promise<EvidenceCandidate[]> {
    const tags = [...input.reading.required, ...input.reading.preferred, ...(input.reading.themes ?? [])];

    if (this.env.GEMINI_API_KEY) {
      try {
        await this.context.index(input.userId);
        const found = await this.context.retrieve({
          userId: input.userId,
          query: [input.description, input.focus].filter(Boolean).join('\n\n'),
          tags,
          providers: input.providers,
        });
        if (found.length > 0) return found;
      } catch {
        // The record could not be indexed now. A job retries it with backoff, and this resume uses the plain ranking.
        await this.embeddings.schedule(input.userId);
      }
    }
    return this.rank(input.userId, tags, input.providers);
  }

  private async rank(userId: string, tags: string[], providers: string[]): Promise<EvidenceCandidate[]> {
    const wanted = pgArray(tags.map((tag) => tag.toLowerCase()));
    const only = providers.length ? pgArray(providers.map((provider) => provider.toLowerCase())) : null;
    const result = await this.db.execute(sql`
      select e.id, e.title, e.claim_text, e.skills, e.topics, e.project_key, e.source_provider, e.source_where, e.valid_from, e.pinned
        from public.candidate_evidence e
       where e.user_id = ${userId} and not e.excluded and e.verification_status <> 'rejected'
         and (${only}::text[] is null or lower(e.source_provider) = any(${only}::text[]))
       order by e.pinned desc,
                (select count(*) from unnest(e.skills) s where lower(s) = any(${wanted}::text[])) desc,
                e.valid_from desc nulls last, e.created_at desc
       limit ${this.settings.evidenceLimit}`);

    return (result as unknown as { rows: Record<string, unknown>[] }).rows.map((row) => ({
      id: row.id as string,
      title: (row.title as string | null) ?? '',
      claimText: row.claim_text as string,
      skills: (row.skills as string[]) ?? [],
      topics: (row.topics as string[]) ?? [],
      projectKey: (row.project_key as string | null) ?? null,
      source: SOURCE_LABEL[String(row.source_provider ?? '').toLowerCase()] ?? 'MANUAL',
      where: (row.source_where as string | null) ?? null,
      date: row.valid_from ? new Date(row.valid_from as string).toISOString().slice(0, 10) : null,
      pinned: Boolean(row.pinned),
    }));
  }
}
