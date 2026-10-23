// The person's evolving context: embeds evidence as it changes, and finds the
// entries a given job or emphasis needs. Retrieval is hybrid: vector similarity,
// full-text match, and overlap with the entry's metadata tags are ranked separately
// and merged with reciprocal rank fusion, so no single signal can bury a good entry.

import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import type { Database } from '../db';
import { candidateEvidence, evidenceEmbeddings } from '../db/schema';
import type { ApiEnv } from '../config/env';
import { DB, ENV, LLM_CLIENT } from '../tokens';
import type { EvidenceCandidate } from './ai-engine';
import type { LlmClient } from './llm';

export interface RetrieveRequest {
  userId: string;
  /** The job description, or a short statement of what to emphasise. */
  query: string;
  /** Skills and themes to match against entry tags (job requirements, the person's stated focus). */
  tags: string[];
  /** Entries whose source provider is in this list; empty means all. */
  providers?: string[];
  limit?: number;
}

/** Reciprocal rank fusion constant: the usual default, flattening the difference between ranks 1 and 10. */
const RRF_K = 60;
/** Candidates each signal contributes before fusion. */
const PER_SIGNAL = 60;
const INDEX_BATCH = 100;
const SOURCE_LABEL: Record<string, EvidenceCandidate['source']> = {
  github: 'GITHUB',
  cv: 'CV',
  linkedin: 'LINKEDIN',
  portfolio: 'PORTFOLIO',
  x: 'X',
  manual: 'MANUAL',
};

/** A Postgres array literal. Drizzle would spread a JS array into separate parameters. */
const pgArray = (values: string[]) => `{${values.map((value) => `"${value.replace(/["\\]/g, (char) => `\\${char}`)}"`).join(',')}}`;

const vectorLiteral = (vector: number[]) => `[${vector.join(',')}]`;

/** The text that is embedded. Changing this changes `content_hash`, which re-embeds the entry. */
export function embeddingText(row: { title: string | null; claimText: string; skills: string[]; topics: string[] }): string {
  const tags = [...row.skills, ...row.topics];
  return `${row.title ? `${row.title}. ` : ''}${row.claimText}${tags.length ? `\nTags: ${tags.join(', ')}` : ''}`;
}

const sha = (text: string) => createHash('sha256').update(text).digest('hex');

@Injectable()
export class ContextService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
    @Inject(LLM_CLIENT) private readonly llm: LlmClient,
  ) {}

  private get version() {
    return `d${this.env.AI_EMBEDDING_DIMENSIONS}`;
  }

  /**
   * Embeds entries that are new or whose text changed since they were embedded.
   * Safe to run again at any time, so it can be triggered after every import or edit.
   */
  async index(userId: string): Promise<{ embedded: number }> {
    const model = this.env.AI_EMBEDDING_MODEL;
    const rows = await this.db
      .select({
        id: candidateEvidence.id,
        title: candidateEvidence.title,
        claimText: candidateEvidence.claimText,
        skills: candidateEvidence.skills,
        topics: candidateEvidence.topics,
        stored: evidenceEmbeddings.contentHash,
      })
      .from(candidateEvidence)
      .leftJoin(
        evidenceEmbeddings,
        and(
          eq(evidenceEmbeddings.evidenceId, candidateEvidence.id),
          eq(evidenceEmbeddings.embeddingModel, model),
          eq(evidenceEmbeddings.embeddingVersion, this.version),
        ),
      )
      .where(and(eq(candidateEvidence.userId, userId), eq(candidateEvidence.excluded, false)));

    const stale = rows
      .map((row) => ({ row, text: embeddingText(row) }))
      .map((entry) => ({ ...entry, hash: sha(entry.text) }))
      .filter((entry) => entry.hash !== entry.row.stored);

    let embedded = 0;
    for (let start = 0; start < stale.length; start += INDEX_BATCH) {
      const batch = stale.slice(start, start + INDEX_BATCH);
      const vectors = await this.llm.embed({ texts: batch.map((entry) => entry.text), kind: 'document', userId });
      await this.db
        .insert(evidenceEmbeddings)
        .values(
          batch.map((entry, i) => ({
            evidenceId: entry.row.id,
            userId,
            embeddingModel: model,
            embeddingVersion: this.version,
            contentHash: entry.hash,
            embedding: vectors[i],
          })),
        )
        .onConflictDoUpdate({
          target: [evidenceEmbeddings.evidenceId, evidenceEmbeddings.embeddingModel, evidenceEmbeddings.embeddingVersion],
          set: { contentHash: sql`excluded.content_hash`, embedding: sql`excluded.embedding`, createdAt: sql`now()` },
        });
      embedded += batch.length;
    }
    return { embedded };
  }

  /**
   * The entries to write from. Excluded and rejected entries never come back; pinned
   * entries always do. Everything else is ranked by three signals and fused.
   */
  async retrieve(request: RetrieveRequest): Promise<EvidenceCandidate[]> {
    const limit = request.limit ?? this.env.AI_EVIDENCE_LIMIT;
    const [queryVector] = await this.llm.embed({ texts: [request.query.slice(0, 6000)], kind: 'query', userId: request.userId });
    const tags = [...new Set(request.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
    const words = [...new Set(request.query.toLowerCase().match(/[a-z][a-z0-9+#.]{2,}/g) ?? [])].slice(0, 60);
    const tsQuery = words.map((word) => word.replace(/[^a-z0-9]/g, '')).filter(Boolean).join(' | ');
    const providers = request.providers?.length ? pgArray(request.providers.map((p) => p.toLowerCase())) : null;
    const tagArray = pgArray(tags);

    const model = this.env.AI_EMBEDDING_MODEL;
    const dims = this.env.AI_EMBEDDING_DIMENSIONS;
    const vec = `${vectorLiteral(queryVector)}`;

    const eligible = sql`e.user_id = ${request.userId}
      and not e.excluded
      and e.verification_status <> 'rejected'
      and (${providers}::text[] is null or lower(e.source_provider) = any(${providers}::text[]))`;

    const result = await this.db.transaction(async (tx) => {
      // With many users in one index, an approximate scan can return neighbours that all
      // belong to someone else and then filter them out. Iterative scan keeps going until
      // enough of this person's rows are found. Older pgvector does not have the setting.
      try {
        await tx.transaction((inner) => inner.execute(sql`select set_config('hnsw.iterative_scan', 'relaxed_order', true)`));
      } catch {
        // Not available here; the user_id filter and small per-user sets still give correct results.
      }
      return tx.execute(sql`
        with by_vector as (
          select e.id, row_number() over (order by emb.embedding operator(extensions.<=>) ${vec}::extensions.halfvec(${sql.raw(String(dims))})) as rank
          from public.evidence_embeddings emb
          join public.candidate_evidence e on e.id = emb.evidence_id
          where emb.user_id = ${request.userId}
            and emb.embedding_model = ${model} and emb.embedding_version = ${this.version}
            and ${eligible}
          order by emb.embedding operator(extensions.<=>) ${vec}::extensions.halfvec(${sql.raw(String(dims))})
          limit ${PER_SIGNAL}
        ),
        by_text as (
          select e.id, row_number() over (order by ts_rank_cd(e.claim_tsv, query.q) desc) as rank
          from public.candidate_evidence e, (select to_tsquery('english', ${tsQuery || 'xxnomatchxx'}) as q) query
          where ${eligible} and e.claim_tsv @@ query.q
          order by ts_rank_cd(e.claim_tsv, query.q) desc
          limit ${PER_SIGNAL}
        ),
        by_tags as (
          select e.id, row_number() over (order by overlap.n desc, e.pinned desc) as rank
          from public.candidate_evidence e
          cross join lateral (
            select count(*) as n from unnest(e.skills || e.topics) as tag where lower(tag) = any(${tagArray}::text[])
          ) overlap
          where ${eligible} and overlap.n > 0
          order by overlap.n desc
          limit ${PER_SIGNAL}
        ),
        fused as (
          select id, sum(1.0 / (${RRF_K} + rank)) as score
          from (select * from by_vector union all select * from by_text union all select * from by_tags) all_signals
          group by id
        )
        select e.id, e.title, e.claim_text, e.skills, e.topics, e.project_key, e.source_provider, e.source_where,
               e.valid_from, e.pinned, coalesce(f.score, 0) as score
        from public.candidate_evidence e
        left join fused f on f.id = e.id
        where ${eligible} and (f.id is not null or e.pinned)
        order by e.pinned desc, coalesce(f.score, 0) desc
        limit ${limit}
      `);
    });

    // node-postgres and PGlite both answer with { rows }.
    return (result as unknown as { rows: Record<string, unknown>[] }).rows.map((r) => {
      return {
        id: r.id as string,
        title: (r.title as string | null) ?? '',
        claimText: r.claim_text as string,
        skills: (r.skills as string[]) ?? [],
        topics: (r.topics as string[]) ?? [],
        projectKey: (r.project_key as string | null) ?? null,
        source: SOURCE_LABEL[String(r.source_provider ?? '').toLowerCase()] ?? 'MANUAL',
        where: (r.source_where as string | null) ?? null,
        date: r.valid_from ? new Date(r.valid_from as string).toISOString().slice(0, 10) : null,
        pinned: Boolean(r.pinned),
      };
    });
  }
}
