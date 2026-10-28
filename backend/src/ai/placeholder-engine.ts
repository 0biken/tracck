import { Injectable } from '@nestjs/common';
import { ApiError, type Bullet, type CvReviewView, type EvidenceRef, type ResumeContent, type ResumeGroup, type ResumeSection, type RoleId } from '@tracck/shared';
import type {
  AiEngine,
  EvidenceCandidate,
  EvidenceType,
  ExtractedEvidence,
  GenerateInput,
  JobReading,
  ResumeDraft,
  SourceDocument,
} from './ai-engine';
import { getTemplate } from '../templates/registry';
import { defaultLayout, headerDetails, skillUses } from './layout';
import { findSkills, guessRole } from './lexicon';

const MAX_CLAIM = 600;
const MAX_ENTRIES_PER_DOCUMENT = 60;

const clean = (text: string) => text.replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
const truncate = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`);

/** The first sentences of an entry, at most 38 words, as a bullet in the entry's own words. */
function sentence(text: string): string {
  let result = '';
  for (const part of clean(text).replace(/\s+/g, ' ').split(/(?<=[.!?])\s/)) {
    const next = result ? `${result} ${part}` : part;
    if (next.split(' ').length > 38) break;
    result = next;
  }
  // A single sentence longer than the limit is cut at a word.
  if (!result) result = clean(text).replace(/\s+/g, ' ').split(' ').slice(0, 38).join(' ').replace(/[,;:\s]+$/, '');
  return /[.!?]$/.test(result) ? result : `${result}.`;
}

/** First sentence or line, as a title. */
function titleOf(block: string): string {
  const line = block.split('\n')[0] ?? block;
  const sentence = line.split(/(?<=[.!?])\s/)[0] ?? line;
  return truncate(sentence.replace(/^[-•*\d.)\s]+/, ''), 90);
}

/** Paragraphs and bullet groups, each long enough to mean something. */
function blocksOf(text: string): string[] {
  return clean(text)
    .split(/\n\s*\n|\n(?=[•*-]\s)/)
    .map((block) => block.trim())
    .filter((block) => block.length >= 40);
}

/** Whole sentences packed into claims of at most `max` characters, so nothing is dropped. */
function packed(text: string, max: number): string[] {
  const claims: string[] = [];
  let current = '';
  for (const part of text.split(/(?<=[.!?])\s+/)) {
    if (current && `${current} ${part}`.length > max) {
      claims.push(current);
      current = part;
    } else {
      current = current ? `${current} ${part}` : part;
    }
  }
  if (current) claims.push(current);
  // A single run longer than the limit (no sentence breaks) is cut into windows.
  return claims.flatMap((claim) => {
    const windows: string[] = [];
    for (let start = 0; start < claim.length; start += max) windows.push(claim.slice(start, start + max));
    return windows;
  });
}

/**
 * The stand-in for the AI engine. It reads nothing between the lines: it splits
 * source material into entries exactly as written, tags skills from a word list,
 * and reads a job by the same word list. Writing a resume picks the entries that
 * match the job and reuses their own wording, so it cannot state a fact the person
 * did not write. It is a demo of the flow; the real engine writes and checks properly.
 */
@Injectable()
export class PlaceholderEngine implements AiEngine {
  readonly name = 'placeholder';

  async extractEvidence(document: SourceDocument): Promise<ExtractedEvidence[]> {
    const hint = document.skillsHint ?? [];
    const wholeDocument = ['github_repo', 'github_contribution', 'manual_experience'].includes(document.kind);

    const blocks = wholeDocument ? packed(clean(document.text), MAX_CLAIM) : blocksOf(document.text).flatMap((block) => packed(block, MAX_CLAIM));

    return blocks.filter(Boolean).slice(0, MAX_ENTRIES_PER_DOCUMENT).map((block) => {
      const evidenceType: EvidenceType =
        document.kind === 'github_repo'
          ? 'project'
          : document.kind === 'github_contribution'
            ? 'achievement'
            : /\d/.test(block)
              ? 'achievement'
              : 'responsibility';
      return {
        evidenceType,
        title: wholeDocument && document.title ? truncate(document.title, 90) : titleOf(block),
        claimText: truncate(block, MAX_CLAIM),
        skills: [...new Set([...hint, ...findSkills(block)])],
        projectKey: document.projectKey ?? null,
        validFrom: document.date,
        where: document.where,
      };
    });
  }

  async parseJob(description: string): Promise<JobReading> {
    const lines = description.split(/\n/).map((line) => line.trim());
    const required = new Set<string>();
    const preferred = new Set<string>();

    // "Nice to have" and similar mark the rest of that line, or the lines after it, as preferred.
    let inPreferred = false;
    for (const line of lines) {
      if (/^(nice to have|preferred|bonus|good to have|plus)\b/i.test(line) || /\b(nice to have|preferred)\s*:/i.test(line)) {
        inPreferred = true;
      } else if (/^(requirements?|responsibilities|what you|qualifications|about)\b/i.test(line)) {
        inPreferred = false;
      }
      const preferredLine = inPreferred || /\bnice to have\b/i.test(line);
      for (const skill of findSkills(line)) {
        if (preferredLine) preferred.add(skill);
        else if (!preferred.has(skill)) required.add(skill);
      }
    }
    for (const skill of preferred) required.delete(skill);

    return { required: [...required], preferred: [...preferred], roleId: guessRole(lines.slice(0, 3).join(' ') || description) };
  }

  async generateResume(input: GenerateInput): Promise<ResumeDraft> {
    if (input.evidence.length === 0) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Add some evidence from your sources before writing a resume.');
    }
    const wanted = new Set([...input.job.required, ...input.job.preferred].map((skill) => skill.toLowerCase()));
    const overlap = (entry: EvidenceCandidate) => entry.skills.filter((skill) => wanted.has(skill.toLowerCase())).length;
    const ranked = [...input.evidence].sort((a, b) => Number(b.pinned) - Number(a.pinned) || overlap(b) - overlap(a));
    const chosen = ranked.slice(0, input.length === 'one_page' ? 8 : 16);

    const evidenceRefs: Record<string, EvidenceRef> = {};
    const groups = new Map<string, ResumeGroup>();
    let count = 0;
    for (const entry of chosen) {
      const key = entry.projectKey ?? 'other';
      const group: ResumeGroup = groups.get(key) ?? {
        id: `g${groups.size + 1}`,
        title: entry.projectKey ? (entry.where ?? entry.projectKey) : 'Other work',
        year: entry.date?.slice(0, 4),
        bullets: [],
      };
      if (group.bullets.length >= 3) continue;
      count += 1;
      evidenceRefs[entry.id] = { id: entry.id, source: entry.source, where: entry.where, date: entry.date, original: entry.claimText };
      const bullet: Bullet = { id: `b${count}`, text: sentence(entry.claimText), evidence: [entry.id] };
      group.bullets.push(bullet);
      groups.set(key, group);
    }

    const used = [...new Set([...groups.values()].flatMap((group) => group.bullets.flatMap((bullet) => bullet.evidence)))];
    const skills = [...new Set(chosen.flatMap((entry) => entry.skills))].sort((a, b) => Number(wanted.has(b.toLowerCase())) - Number(wanted.has(a.toLowerCase()))).slice(0, 14);
    const have = new Set(chosen.flatMap((entry) => entry.skills.map((skill) => skill.toLowerCase())));

    const sections: ResumeSection[] = [
      { id: 's-experience', heading: 'Experience and projects', kind: 'groups', groups: [...groups.values()] },
      ...(skills.length ? [{ id: 's-skills', heading: 'Skills', kind: 'text' as const, text: skills.join(', ') }] : []),
    ];
    const template = getTemplate(input.templateId);
    const content: ResumeContent = {
      header: { name: input.person.name, details: headerDetails(input.person, template.details) },
      templateId: template.id,
      layout: defaultLayout(sections, skillUses(chosen)),
      sections,
      evidenceRefs,
    };
    return {
      content,
      usedEvidenceIds: used,
      review: {
        score: null,
        revisions: 0,
        unresolved: [],
        removedBullets: 0,
        uncoveredRequirements: input.job.required.filter((skill) => !have.has(skill.toLowerCase())),
      },
    };
  }

  /** Plain rules over the text: figures, weak openers and contact details. No model. */
  async reviewCv(input: { text: string; file: string | null; roleId: RoleId | null }): ReturnType<AiEngine['reviewCv']> {
    const lines = input.text.split('\n').map((line) => line.trim()).filter((line) => line.length > 25);
    const figures = lines.filter((line) => /\d/.test(line)).length;
    const weak = lines.find((line) => /^[-•*\s]*(responsible for|worked on|helped|assisted|involved in|duties included)/i.test(line));
    const words = input.text.split(/\s+/).filter(Boolean).length;
    const issues: CvReviewView['issues'] = [];

    if (lines.length > 0 && figures / lines.length < 0.25) {
      issues.push({
        title: 'Few lines carry a number',
        body: `${figures} of ${lines.length} lines contain a figure. Readers trust results they can measure.`,
        fix: 'Add a count, a percentage or a time saved to the lines where you know it.',
      });
    }
    if (weak) {
      issues.push({
        title: 'Some lines start with a weak phrase',
        body: 'Phrases like "responsible for" say what the job was, not what you did.',
        quote: weak.replace(/^[-•*\s]+/, ''),
        fix: 'Start with what you did and what changed because of it.',
      });
    }
    if (!/@/.test(input.text)) {
      issues.push({ title: 'No email address found', body: 'A reader cannot reply to a CV without one.', fix: 'Put your email near the top.' });
    }
    if (words > 900) {
      issues.push({ title: 'It is long', body: `About ${words} words. Most readers give a CV under a minute.`, fix: 'Keep the most relevant work and cut the rest.' });
    }
    return {
      file: input.file,
      roleFamily: input.roleId,
      stats: [
        { n: words, label: 'words' },
        { n: lines.length, label: 'lines read' },
        { n: figures, label: 'lines with a figure' },
      ],
      issues,
      engine: this.name,
    };
  }
}
