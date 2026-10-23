import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { EntrySource, GraphProject, GraphView } from '@tracck/shared';
import type { Database } from '../db';
import { DB } from '../tokens';

const MAX_PROJECTS = 12;
const ENTRIES_PER_PROJECT = 3;

const rowsOf = <T>(result: unknown) => (result as { rows: T[] }).rows;
const asSource = (provider: string | null) => (provider ?? 'manual').toUpperCase() as EntrySource;

interface ProjectRow {
  key: string;
  name: string | null;
  count: number;
  first: string | null;
  last: string | null;
  sources: number;
  pinned: boolean;
  used: number;
}

/** The Career Graph: what the person's record adds up to, aggregated in SQL. */
@Injectable()
export class GraphService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async view(userId: string): Promise<GraphView> {
    const [summary] = rowsOf<{ entries: number; updated_at: string | null }>(
      await this.db.execute(sql`
        select count(*)::int as entries, max(updated_at) as updated_at
          from public.candidate_evidence where user_id = ${userId} and not excluded`),
    );

    const months = rowsOf<{ month: string; count: number }>(
      await this.db.execute(sql`
        select to_char(m, 'YYYY-MM') as month,
               (select count(*)::int from public.candidate_evidence e
                 where e.user_id = ${userId} and not e.excluded
                   and date_trunc('month', coalesce(e.valid_from::timestamptz, e.created_at)) = m) as count
          from generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') m
         order by m`),
    );

    const projectRows = rowsOf<ProjectRow>(
      await this.db.execute(sql`
        select e.project_key as key,
               min(e.source_where) as name,
               count(*)::int as count,
               min(e.valid_from)::text as first,
               max(e.valid_from)::text as last,
               count(distinct e.source_provider)::int as sources,
               bool_or(e.pinned) as pinned,
               (select count(distinct g.resume_document_id)::int from public.generation_runs g
                 where g.user_id = ${userId} and g.status = 'succeeded' and g.resume_document_id is not null
                   and g.retrieved_evidence_ids && array_agg(e.id)) as used
          from public.candidate_evidence e
         where e.user_id = ${userId} and not e.excluded and e.project_key is not null
         group by e.project_key
         order by count(*) desc, e.project_key
         limit ${MAX_PROJECTS + 1}`),
    );
    const [{ total }] = rowsOf<{ total: number }>(
      await this.db.execute(sql`
        select count(distinct project_key)::int as total
          from public.candidate_evidence where user_id = ${userId} and not excluded and project_key is not null`),
    );

    const projects: GraphProject[] = [];
    for (const row of projectRows.slice(0, MAX_PROJECTS)) {
      const entries = rowsOf<{ date: string | null; provider: string | null; text: string }>(
        await this.db.execute(sql`
          select coalesce(valid_from::text, to_char(created_at at time zone 'utc', 'YYYY-MM-DD')) as date,
                 source_provider as provider, claim_text as text
            from public.candidate_evidence
           where user_id = ${userId} and not excluded and project_key = ${row.key}
           order by valid_from desc nulls last, created_at desc limit ${ENTRIES_PER_PROJECT}`),
      );
      const skills = rowsOf<{ skill: string }>(
        await this.db.execute(sql`
          select s as skill from public.candidate_evidence e, unnest(e.skills) s
           where e.user_id = ${userId} and not e.excluded and e.project_key = ${row.key}
           group by s order by count(*) desc, s limit 6`),
      ).map((r) => r.skill);

      projects.push({
        id: row.key,
        name: row.name ?? row.key,
        count: row.count,
        period: { from: row.first, to: row.last },
        sources: row.sources,
        // Summaries are written by the AI engine when one is configured; until then there is none.
        summary: null,
        skills,
        usedInResumes: row.used ?? 0,
        pinned: row.pinned,
        entries: entries.map((entry) => ({ date: entry.date, source: asSource(entry.provider), text: entry.text })),
        more: Math.max(0, row.count - ENTRIES_PER_PROJECT),
      });
    }

    const skills = rowsOf<{ name: string; count: number }>(
      await this.db.execute(sql`
        select s as name, count(*)::int as count
          from public.candidate_evidence e, unnest(e.skills) s
         where e.user_id = ${userId} and not e.excluded
         group by s order by count(*) desc, s limit 24`),
    );

    return {
      entries: summary?.entries ?? 0,
      updatedAt: summary?.updated_at ? new Date(summary.updated_at).toISOString() : null,
      months,
      projects,
      moreProjects: Math.max(0, total - projects.length),
      skills,
    };
  }
}

