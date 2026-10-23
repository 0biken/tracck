import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import {
  ApiError,
  type CreateEvidenceRequest,
  type DuplicateView,
  type EntrySource,
  type EvidencePage,
  type EvidenceShow,
  type EvidenceView,
  type ResolveDuplicateRequest,
  type SourceProvider,
  type UpdateEvidenceRequest,
} from '@tracck/shared';
import { findSkills } from '../ai/lexicon';
import type { Database } from '../db';
import { candidateEvidence } from '../db/schema';
import { DB } from '../tokens';

const PAGE_SIZE = 50;
const PROVIDERS: SourceProvider[] = ['github', 'cv', 'linkedin', 'portfolio', 'x', 'behance', 'manual'];

const TYPE_FOR_KIND = {
  experience: 'role',
  project: 'project',
  skill: 'skill',
  education: 'education',
} as const;

interface EvidenceRow {
  id: string;
  number: number;
  provider: string | null;
  date: string | null;
  where: string | null;
  title: string | null;
  claim: string;
  skills: string[];
  pinned: boolean;
  excluded: boolean;
  edited: boolean;
  used: number;
  original: string | null;
  version: number;
  created_at: string;
}

function rowsOf<T>(result: unknown): T[] {
  return (result as { rows: T[] }).rows;
}

export const hashOf = (userId: string, claim: string) =>
  createHash('sha256').update(`${userId}\n${claim.trim().toLowerCase()}`).digest('hex');

const asSource = (provider: string | null): EntrySource =>
  (PROVIDERS.includes(provider as SourceProvider) ? provider! : 'manual').toUpperCase() as EntrySource;

/** The first sentence or so, used when an entry has no title of its own. */
const titleFrom = (claim: string) => {
  const line = claim.split(/(?<=[.!?])\s|\n/)[0].trim();
  return line.length > 80 ? `${line.slice(0, 77).trimEnd()}...` : line;
};

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const toView = (row: EvidenceRow): EvidenceView => ({
  id: row.id,
  number: row.number,
  source: asSource(row.provider),
  date: row.date,
  where: row.where,
  title: row.title ?? titleFrom(row.claim),
  body: row.claim,
  skills: row.skills ?? [],
  pinned: row.pinned,
  excluded: row.excluded,
  edited: row.edited,
  usedInResumes: row.used,
  original: row.original ?? row.claim,
  version: row.version,
});

/** The person's evidence library: read, add, edit, pin, hide, and sort out duplicates. */
@Injectable()
export class EvidenceService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async list(
    userId: string,
    query: { show: EvidenceShow; source?: SourceProvider; q?: string; cursor?: string },
  ): Promise<EvidencePage> {
    const cursor = decodeCursor(query.cursor);
    const search = query.q ? `%${query.q.replace(/[\\%_]/g, '\\$&')}%` : null;

    const showFilter = {
      all: sql`not e.excluded`,
      pinned: sql`e.pinned`,
      excluded: sql`e.excluded`,
      edited: sql`e.user_edited`,
      duplicates: sql`exists (select 1 from public.evidence_relations r
                               where r.user_id = e.user_id and r.relation_type = 'possible_duplicate'
                                 and (r.from_evidence_id = e.id or r.to_evidence_id = e.id))`,
    }[query.show];

    const result = await this.db.execute(sql`
      with numbered as (
        select e.*, row_number() over (order by e.created_at, e.id)::int as number
          from public.candidate_evidence e where e.user_id = ${userId}
      )
      select e.id, e.number, e.source_provider as provider,
             coalesce(e.valid_from::text, to_char(e.created_at at time zone 'utc', 'YYYY-MM-DD')) as date,
             e.source_where as "where", e.title, e.claim_text as claim, e.skills,
             e.pinned, e.excluded, e.user_edited as edited, e.original_text as original, e.version,
             e.created_at,
             (select count(distinct g.resume_document_id)::int from public.generation_runs g
               where g.user_id = e.user_id and g.status = 'succeeded' and g.resume_document_id is not null
                 and e.id = any(g.retrieved_evidence_ids)) as used
        from numbered e
       where ${showFilter}
         and (${query.source ?? null}::text is null or e.source_provider = ${query.source ?? null})
         and (${search}::text is null or e.title ilike ${search} or e.claim_text ilike ${search})
         and (${cursor?.at ?? null}::timestamptz is null
              or (e.created_at, e.id) < (${cursor?.at ?? null}::timestamptz, ${cursor?.id ?? null}::uuid))
       order by e.created_at desc, e.id desc
       limit ${PAGE_SIZE + 1}`);
    const rows = rowsOf<EvidenceRow>(result);
    const page = rows.slice(0, PAGE_SIZE);
    const last = page[page.length - 1];

    return {
      items: page.map(toView),
      nextCursor: rows.length > PAGE_SIZE && last ? encodeCursor(last.created_at, last.id) : null,
      counts: await this.counts(userId),
      duplicates: await this.duplicates(userId),
    };
  }

  private async counts(userId: string): Promise<EvidencePage['counts']> {
    const [totals] = rowsOf<{ all: number; pinned: number; excluded: number; edited: number; duplicates: number }>(
      await this.db.execute(sql`
        select count(*) filter (where not excluded)::int as "all",
               count(*) filter (where pinned)::int as pinned,
               count(*) filter (where excluded)::int as excluded,
               count(*) filter (where user_edited)::int as edited,
               (select count(*)::int from public.evidence_relations
                 where user_id = ${userId} and relation_type = 'possible_duplicate') as duplicates
          from public.candidate_evidence where user_id = ${userId}`),
    );
    const bySource = Object.fromEntries(PROVIDERS.map((provider) => [provider, 0])) as Record<SourceProvider, number>;
    for (const row of rowsOf<{ provider: string | null; n: number }>(
      await this.db.execute(sql`
        select source_provider as provider, count(*)::int as n
          from public.candidate_evidence where user_id = ${userId} and not excluded group by 1`),
    )) {
      if (row.provider && row.provider in bySource) bySource[row.provider as SourceProvider] = row.n;
    }
    return { ...(totals ?? { all: 0, pinned: 0, excluded: 0, edited: 0, duplicates: 0 }), bySource };
  }

  private async duplicates(userId: string): Promise<DuplicateView[]> {
    const rows = rowsOf<{
      id: string;
      a_id: string; a_provider: string | null; a_date: string | null; a_text: string;
      b_id: string; b_provider: string | null; b_date: string | null; b_text: string;
    }>(
      await this.db.execute(sql`
        select r.id,
               a.id as a_id, a.source_provider as a_provider, a.valid_from::text as a_date, a.claim_text as a_text,
               b.id as b_id, b.source_provider as b_provider, b.valid_from::text as b_date, b.claim_text as b_text
          from public.evidence_relations r
          join public.candidate_evidence a on a.id = r.from_evidence_id
          join public.candidate_evidence b on b.id = r.to_evidence_id
         where r.user_id = ${userId} and r.relation_type = 'possible_duplicate'
         order by r.created_at desc limit 20`),
    );
    return rows.map((row) => ({
      id: row.id,
      a: { id: row.a_id, source: asSource(row.a_provider), date: row.a_date, text: row.a_text },
      b: { id: row.b_id, source: asSource(row.b_provider), date: row.b_date, text: row.b_text },
    }));
  }

  async get(userId: string, id: string): Promise<EvidenceView> {
    const [row] = rowsOf<EvidenceRow>(
      await this.db.execute(sql`
        select * from (
          select e.id, row_number() over (order by e.created_at, e.id)::int as number,
                 e.source_provider as provider,
                 coalesce(e.valid_from::text, to_char(e.created_at at time zone 'utc', 'YYYY-MM-DD')) as date,
                 e.source_where as "where", e.title, e.claim_text as claim, e.skills,
                 e.pinned, e.excluded, e.user_edited as edited, e.original_text as original, e.version, e.created_at,
                 (select count(distinct g.resume_document_id)::int from public.generation_runs g
                   where g.user_id = e.user_id and g.status = 'succeeded' and g.resume_document_id is not null
                     and e.id = any(g.retrieved_evidence_ids)) as used
            from public.candidate_evidence e where e.user_id = ${userId}
        ) n where n.id = ${id}`),
    );
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'We could not find that entry.');
    return toView(row);
  }

  /** An entry the person wrote themselves. It counts as confirmed, because they are the source. */
  async create(userId: string, input: CreateEvidenceRequest): Promise<EvidenceView> {
    const contentHash = hashOf(userId, input.body);
    const [existing] = await this.db
      .select({ id: candidateEvidence.id })
      .from(candidateEvidence)
      .where(and(eq(candidateEvidence.userId, userId), eq(candidateEvidence.contentHash, contentHash)))
      .limit(1);
    if (existing) return this.get(userId, existing.id);

    const skills = (input.skills?.length ? input.skills : findSkills(`${input.title} ${input.body}`)).slice(0, 20);
    const [row] = await this.db
      .insert(candidateEvidence)
      .values({
        userId,
        evidenceType: TYPE_FOR_KIND[input.kind],
        claimText: input.body,
        title: input.title,
        originalText: input.body,
        skills,
        projectKey: input.kind === 'project' ? slug(input.title) || null : null,
        sourceProvider: 'manual',
        sourceWhere: input.title,
        validFrom: input.from ?? null,
        validTo: input.to ?? null,
        verificationStatus: 'user_confirmed',
        contentHash,
      })
      .returning({ id: candidateEvidence.id });
    return this.get(userId, row.id);
  }

  /** Changes are refused when the person was looking at an older version of the entry. */
  async update(userId: string, id: string, input: UpdateEvidenceRequest): Promise<EvidenceView> {
    const current = await this.get(userId, id);
    const body = input.body?.trim();
    const title = input.title?.trim();

    const [updated] = await this.db
      .update(candidateEvidence)
      .set({
        ...(input.pinned !== undefined && { pinned: input.pinned }),
        ...(input.excluded !== undefined && { excluded: input.excluded }),
        ...(body !== undefined && {
          claimText: body,
          contentHash: hashOf(userId, body),
          userEdited: body !== current.original || (title ?? current.title) !== current.title,
        }),
        ...(title !== undefined && { title, userEdited: true }),
        version: sql`${candidateEvidence.version} + 1`,
      })
      .where(and(eq(candidateEvidence.id, id), eq(candidateEvidence.userId, userId), eq(candidateEvidence.version, input.version)))
      .returning({ id: candidateEvidence.id });

    if (!updated) {
      throw new ApiError(409, 'VERSION_CONFLICT', 'This entry changed somewhere else. Reload to see the latest version.');
    }
    return this.get(userId, id);
  }

  /** Merging keeps the entry the person touched (or the older one) and moves everything else onto it. */
  async resolveDuplicate(userId: string, relationId: string, input: ResolveDuplicateRequest): Promise<void> {
    const [relation] = rowsOf<{ from_id: string; to_id: string }>(
      await this.db.execute(sql`
        select from_evidence_id as from_id, to_evidence_id as to_id from public.evidence_relations
         where id = ${relationId} and user_id = ${userId} and relation_type = 'possible_duplicate'`),
    );
    if (!relation) throw new ApiError(404, 'NOT_FOUND', 'We could not find that pair.');

    if (input.action === 'keep_both') {
      await this.db.execute(sql`delete from public.evidence_relations where id = ${relationId} and user_id = ${userId}`);
      return;
    }

    await this.db.transaction(async (tx) => {
      const [keep] = rowsOf<{ id: string }>(
        await tx.execute(sql`
          select id from public.candidate_evidence
           where user_id = ${userId} and id in (${relation.from_id}, ${relation.to_id})
           order by (pinned or user_edited) desc, created_at asc, id asc limit 1`),
      );
      const dropId = keep.id === relation.from_id ? relation.to_id : relation.from_id;

      await tx.execute(sql`
        insert into public.evidence_sources (evidence_id, source_item_id, support_type, support_excerpt)
        select ${keep.id}, source_item_id, support_type, support_excerpt
          from public.evidence_sources where evidence_id = ${dropId}
        on conflict do nothing`);
      await tx.execute(sql`
        update public.candidate_evidence k
           set skills = (select coalesce(array_agg(distinct s), '{}') from unnest(k.skills || d.skills) s),
               pinned = k.pinned or d.pinned,
               version = k.version + 1
          from public.candidate_evidence d
         where k.id = ${keep.id} and d.id = ${dropId}`);
      // Resumes that cited the dropped entry keep pointing somewhere real.
      await tx.execute(sql`
        update public.generation_runs
           set retrieved_evidence_ids = array_replace(retrieved_evidence_ids, ${dropId}::uuid, ${keep.id}::uuid)
         where user_id = ${userId} and ${dropId}::uuid = any(retrieved_evidence_ids)`);
      await tx.execute(sql`delete from public.candidate_evidence where id = ${dropId} and user_id = ${userId}`);
    });
  }
}

function encodeCursor(createdAt: string, id: string) {
  return Buffer.from(`${new Date(createdAt).toISOString()}|${id}`).toString('base64url');
}

function decodeCursor(cursor: string | undefined): { at: string; id: string } | null {
  if (!cursor) return null;
  const [at, id] = Buffer.from(cursor, 'base64url').toString().split('|');
  if (!at || !id || Number.isNaN(Date.parse(at))) throw new ApiError(400, 'VALIDATION_ERROR', 'That page link is not valid.');
  return { at, id };
}
