// Few-shot examples: what a strong resume looks like for a role, and what weak
// wording looks like next to its fix. They live in `resume_examples` so they can be
// added and retired without a deploy. Examples teach style and structure only; the
// prompt says never to copy their facts.

import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { RoleId } from '@tracck/shared';
import type { Database } from '../db';
import { resumeExamples } from '../db/schema';
import { DB } from '../tokens';

export interface GoodExample {
  summary: string;
  sections: { heading: string; groups: { title?: string; bullets: string[] }[] }[];
}

export interface Rewrite {
  before: string;
  after: string;
  why: string;
}

export interface ExampleSet {
  good: GoodExample[];
  rewrites: Rewrite[];
}

@Injectable()
export class ExampleStore {
  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * Examples for one role. Seniority-specific examples win over the "all" ones. The
   * result is the same for every request with these arguments, which keeps the prompt
   * prefix identical and lets the provider cache it.
   */
  async forRole(roleId: RoleId | null, seniority: string | null, limit = { good: 2, rewrites: 4 }): Promise<ExampleSet> {
    if (!roleId) return { good: [], rewrites: [] };
    const rows = await this.db
      .select()
      .from(resumeExamples)
      .where(
        and(
          eq(resumeExamples.roleFamily, roleId),
          eq(resumeExamples.active, true),
          inArray(resumeExamples.seniority, seniority ? [seniority, 'all'] : ['all']),
        ),
      )
      // "all" sorts before entry, mid and senior, so descending puts the specific ones first.
      .orderBy(desc(resumeExamples.seniority), desc(resumeExamples.version), resumeExamples.id);

    const good: GoodExample[] = [];
    const rewrites: Rewrite[] = [];
    for (const row of rows) {
      if (row.exampleKind === 'good' && good.length < limit.good) good.push(row.exampleContentJson as unknown as GoodExample);
      if (row.exampleKind === 'annotated_bad') {
        for (const pair of (row.exampleContentJson as { rewrites?: Rewrite[] }).rewrites ?? []) {
          if (rewrites.length < limit.rewrites) rewrites.push(pair);
        }
      }
    }
    return { good, rewrites };
  }
}

export function renderExamples(set: ExampleSet): string {
  if (set.good.length === 0 && set.rewrites.length === 0) return '';
  const lines: string[] = [
    '<examples>',
    'These show style and structure only. The people, employers and figures in them are invented: never reuse their facts.',
  ];
  set.good.forEach((example, index) => {
    lines.push(`<good_resume n="${index + 1}">`, `Summary: ${example.summary}`);
    for (const section of example.sections) {
      lines.push(`## ${section.heading}`);
      for (const group of section.groups) {
        if (group.title) lines.push(`### ${group.title}`);
        for (const bullet of group.bullets) lines.push(`- ${bullet}`);
      }
    }
    lines.push('</good_resume>');
  });
  if (set.rewrites.length) {
    lines.push('<rewrites>');
    for (const pair of set.rewrites) lines.push(`weak: ${pair.before}`, `strong: ${pair.after}`, `why: ${pair.why}`, '');
    lines.push('</rewrites>');
  }
  lines.push('</examples>');
  return lines.join('\n');
}
