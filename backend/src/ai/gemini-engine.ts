// The real AI engine. Four jobs behind the `AiEngine` interface:
//
//   extractEvidence  source text  -> tagged evidence entries   (cheap model, no thinking)
//   parseJob         job text     -> requirements and themes   (cheap model, no thinking)
//   generateResume   evidence     -> resume, via writer -> checks -> critic -> revise loop
//   reviewCv         existing CV  -> specific feedback
//
// Retrieval happens before this engine is called (see ContextService): the engine
// receives the entries worth writing from and never sees the person's whole library.

import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ApiError,
  type Bullet,
  type TemplateLayout,
  type CvReviewView,
  type ResumeContent,
  type ResumeGroup,
  type ResumeSection,
  type RoleId,
} from '@tracck/shared';
import { AI_SETTINGS, LLM_CLIENT } from '../tokens';
import type { TemplateDefinition } from '../templates/template';
import { getTemplate } from '../templates/registry';
import type { AiEngine, DraftReview, EvidenceCandidate, ExtractedEvidence, GenerateInput, JobReading, ResumeDraft, SourceDocument } from './ai-engine';
import { type ExampleSet, ExampleStore, renderExamples } from './examples';
import { TEXT_LIMITS, type AiSettings } from './ai.config';
import { isTokensExhausted, type LlmClient } from './llm';
import { buildRevisionGraph } from './revision-graph';
import { defaultLayout, headerDetails, layoutFrom, skillUses, traitsOf, type SkillUse } from './layout';
import { PlaceholderEngine } from './placeholder-engine';
import {
  criticPrompt,
  criticSystem,
  extractSystem,
  formatterPrompt,
  formatterSystem,
  jobSystem,
  lengthLimit,
  renderDraft,
  reviewSystem,
  reviseSuffix,
  templateBlock,
  toIssues,
  writerPrompt,
  writerSystem,
} from './prompts';
import {
  critiqueSchema,
  cvReviewSchema,
  draftSchema,
  extractionSchema,
  jobReadingSchema,
  layoutChoiceSchema,
  type Critique,
  type DraftOutput,
} from './schemas';
import { requirementGaps, styleFindings } from './style';
import { supportedSkills, verifyBullets, type BulletDraft, type Finding, type PoolEntry } from './verify';

const CHUNK_CHARS = 12_000;
const MAX_ENTRIES_PER_DOCUMENT = 60;
/** Critic problems of these kinds ask for a rewrite even when the verdict says pass. */
const SERIOUS = new Set(['unsupported', 'role_rule']);
/** Style problems the checks find exactly. A draft with any of them is revised, like a serious critic problem. */
const STYLE = new Set(['repetition', 'tone']);

/** Splits long text at paragraph breaks so no model call gets more than it can use well. Nothing is dropped. */
function chunk(text: string): string[] {
  if (text.length <= CHUNK_CHARS) return [text];
  // A paragraph longer than one chunk is cut into windows, so its tail is still read.
  const pieces = text.split(/\n\s*\n/).flatMap((paragraph) => {
    const windows: string[] = [];
    for (let start = 0; start < paragraph.length; start += CHUNK_CHARS) windows.push(paragraph.slice(start, start + CHUNK_CHARS));
    return windows;
  });
  const chunks: string[] = [];
  let current = '';
  for (const piece of pieces) {
    if (current && current.length + piece.length + 2 > CHUNK_CHARS) {
      chunks.push(current);
      current = '';
    }
    current += `${current ? '\n\n' : ''}${piece}`;
  }
  if (current) chunks.push(current);
  return chunks;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}(-\d{2}(-\d{2})?)?$/.test(value)) return null;
  const date = new Date(value.length === 4 ? `${value}-01-01` : value.length === 7 ? `${value}-01` : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

interface Numbered {
  sections: { heading: string; groups: { title?: string; year?: string; bullets: (BulletDraft & { id: string })[] }[] }[];
}

/** Gives every bullet an id the reviewer can point at. */
function number(draft: DraftOutput): Numbered {
  let n = 0;
  return {
    sections: draft.sections.map((section) => ({
      heading: section.heading,
      groups: section.groups.map((group) => ({
        title: group.title,
        year: group.year,
        bullets: group.bullets.map((bullet) => ({ id: `b${++n}`, text: bullet.text.trim(), evidence: bullet.evidence, needsNumber: bullet.needsNumber })),
      })),
    })),
  };
}

/** Counts read from the CV itself, so they are exact and cost no model call. */
function cvStats(text: string): { n: number; label: string }[] {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 25);
  return [
    { n: lines.filter((line) => /\d/.test(line)).length, label: 'lines with a figure' },
    { n: lines.length, label: 'lines read' },
  ];
}

const allBullets = (draft: Numbered) => draft.sections.flatMap((section) => section.groups.flatMap((group) => group.bullets));

/** The stored examples for the role, then the template: its sections and the role's sample lines. */
function writerExamples(set: ExampleSet, template: TemplateDefinition, roleId: RoleId | null): string {
  return [renderExamples(set), templateBlock(template, roleId)].filter(Boolean).join('\n\n');
}

@Injectable()
export class GeminiEngine implements AiEngine {
  readonly name: string;
  private readonly logger = new Logger('AiEngine');

  constructor(
    @Inject(AI_SETTINGS) private readonly settings: AiSettings,
    @Inject(LLM_CLIENT) private readonly llm: LlmClient,
    @Inject(ExampleStore) private readonly examples: ExampleStore,
    @Inject(PlaceholderEngine) private readonly fallback: PlaceholderEngine,
  ) {
    this.name = `gemini:${settings.writer.model}`;
  }

  // ─── Reading sources ───────────────────────────────────────────────────────

  async extractEvidence(document: SourceDocument): Promise<ExtractedEvidence[]> {
    if (document.text.trim().length < 40) return this.fallback.extractEvidence(document);
    try {
      const found: ExtractedEvidence[] = [];
      const seen = new Set<string>();
      for (const part of chunk(document.text)) {
        const { data } = await this.llm.json({
          purpose: 'extract',
          model: this.settings.extract.model,
          system: extractSystem(),
          prompt: `<source kind="${document.kind}"${document.title ? ` title="${document.title}"` : ''}>\n${part}\n</source>`,
          schema: extractionSchema,
          temperature: 0,
          // A long README can yield many entries; the model's limit is 65,536, so leave room.
          maxOutputTokens: 16000,
        });
        for (const entry of data.entries) {
          const key = entry.claimText.trim().toLowerCase();
          if (!key || seen.has(key)) continue;
          seen.add(key);
          found.push({
            evidenceType: entry.evidenceType,
            title: entry.title.slice(0, 90),
            claimText: entry.claimText.trim().slice(0, 1500),
            skills: [...new Set([...(document.skillsHint ?? []), ...entry.skills.map((skill) => skill.trim()).filter(Boolean)])],
            topics: [...new Set(entry.topics.map((topic) => topic.trim().toLowerCase()).filter(Boolean))],
            // The source decides a project (a repository); otherwise only a project or a role names one, and never the file name.
            projectKey: document.projectKey ?? (['project', 'role'].includes(entry.evidenceType) && entry.projectKey !== document.title ? entry.projectKey : null),
            validFrom: parseDate(entry.date) ?? document.date,
            where: document.where,
          });
        }
      }
      return found.slice(0, MAX_ENTRIES_PER_DOCUMENT);
    } catch (error) {
      if (isTokensExhausted(error)) throw error;
      // A model outage must not stop a person from importing their sources.
      this.logger.warn(`evidence extraction failed, using the plain reader: ${error instanceof Error ? error.message : error}`);
      return this.fallback.extractEvidence(document);
    }
  }

  /** The word list reads the job first. The model keeps those names, adds what the list missed, and gives the themes. */
  async parseJob(description: string): Promise<JobReading> {
    const listed = await this.fallback.parseJob(description);
    try {
      const { data } = await this.llm.json({
        purpose: 'extract',
        model: this.settings.extract.model,
        system: jobSystem(),
        prompt: `<job_description>\n${description.slice(0, TEXT_LIMITS.job)}\n</job_description>\n<known_skills>${[...listed.required, ...listed.preferred].join(', ')}</known_skills>`,
        schema: jobReadingSchema,
        temperature: 0,
        maxOutputTokens: 1500,
      });
      return {
        required: [...new Set([...listed.required, ...data.required])],
        preferred: [...new Set([...listed.preferred, ...data.preferred])],
        roleId: data.roleId ?? listed.roleId,
        seniority: data.seniority,
        themes: data.themes.map((theme) => theme.toLowerCase()),
      };
    } catch (error) {
      if (isTokensExhausted(error)) throw error;
      this.logger.warn(`job reading failed, using the word list:${error instanceof Error ? error.message : error}`);
      return listed;
    }
  }

  // ─── Writing ───────────────────────────────────────────────────────────────

  async generateResume(input: GenerateInput): Promise<ResumeDraft> {
    if (input.evidence.length === 0) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Add some evidence from your sources before writing a resume.');
    }

    const roleId = input.roleId ?? input.job.roleId;
    const template = getTemplate(input.templateId);
    const pool = input.evidence.slice(0, this.settings.evidenceLimit).map((entry, index) => ({ entry, ref: `E${index + 1}` }));
    const lookup = new Map<string, PoolEntry>(
      pool.map(({ entry, ref }) => [ref, { ref, id: entry.id, text: `${entry.title} ${entry.claimText}`, skills: entry.skills }]),
    );

    const exampleSet = await this.examples.forRole(roleId, input.job.seniority ?? null);
    const system = writerSystem(roleId, input.length, writerExamples(exampleSet, template, roleId));
    const basePrompt = writerPrompt(input, pool);
    const write = async (prompt: string) =>
      (
        await this.llm.json({
          purpose: 'write',
          model: this.settings.writer.model,
          system,
          prompt,
          schema: draftSchema,
          thinking: this.settings.writer.thinking,
          maxOutputTokens: 5000,
          userId: input.userId,
        })
      ).data;

    // Write, then check and revise in a LangGraph loop until the draft passes or the budget runs out.
    const loop = buildRevisionGraph<DraftOutput, Numbered, Finding, Critique>(
      {
        check: async (numbered) => {
          const findings = [...verifyBullets(allBullets(numbered), lookup), ...styleFindings(allBullets(numbered))];
          const mustFix = findings.filter((finding) => finding.severity === 'blocking' || STYLE.has(finding.kind));
          const critique = this.settings.maxRevisions > 0 ? await this.review(input, roleId, numbered, lookup, findings) : null;
          const serious = critique?.issues.filter((issue) => SERIOUS.has(issue.kind)) ?? [];
          const passed = mustFix.length === 0 && serious.length === 0 && (critique === null || critique.verdict === 'pass');
          return { findings, critique, passed };
        },
        revise: async (numbered, findings, critique) => {
          const raw = await write(basePrompt + reviseSuffix(renderDraft(numbered.sections), toIssues(findings, critique)));
          return { raw, draft: number(raw) };
        },
      },
      this.settings.maxRevisions,
    );
    const firstRaw = await write(basePrompt);
    const state = await loop.invoke({ raw: firstRaw, draft: number(firstRaw) });

    const draft = this.assemble(input, pool, lookup, state.raw, state.draft, state.findings, state.critique, state.revisions);
    const entries = pool.map(({ entry }) => entry);
    const layout = await this.format(input, template, draft.content.sections, skillUses(entries), traitsOf(entries));
    return { ...draft, content: { ...draft.content, layout } };
  }

  /** The formatter places the finished resume into the template. Anything it gets wrong falls back to the default layout. */
  private async format(
    input: GenerateInput,
    template: TemplateDefinition,
    sections: ResumeSection[],
    uses: Map<string, SkillUse>,
    traits: Map<string, string>,
  ): Promise<TemplateLayout> {
    const fallback = defaultLayout(sections, uses);
    const groups = sections.flatMap((section) =>
      section.kind === 'groups'
        ? section.groups.map((group) => ({
            id: group.id,
            label: [section.heading, group.title, group.year].filter(Boolean).join(' / '),
            first: group.bullets[0].text,
          }))
        : [],
    );
    if (groups.length === 0) return fallback;

    try {
      const { data } = await this.llm.json({
        purpose: 'write',
        model: this.settings.writer.model,
        system: formatterSystem(template.formatterRules),
        prompt: formatterPrompt({ job: input.job, groups, skills: [...uses.values()].map((use) => use.name), strengths: [...traits.values()] }),
        schema: layoutChoiceSchema,
        temperature: 0,
        maxOutputTokens: 1500,
        userId: input.userId,
      });
      const layout = layoutFrom(data, sections, uses, traits);
      return layout.experienceGroupIds.length > 0 ? layout : fallback;
    } catch (error) {
      if (isTokensExhausted(error)) throw error;
      this.logger.warn(`layout failed, using the default:${error instanceof Error ? error.message : error}`);
      return fallback;
    }
  }

  /** The reviewing model sees only the entries the draft cites, which keeps this call small. */
  private async review(
    input: GenerateInput,
    roleId: RoleId | null,
    draft: Numbered,
    lookup: Map<string, PoolEntry>,
    findings: Finding[],
  ): Promise<Critique> {
    const refs = [...new Set(allBullets(draft).flatMap((bullet) => bullet.evidence))].filter((ref) => lookup.has(ref));
    const { data } = await this.llm.json({
      purpose: 'check',
      model: this.settings.critic.model,
      system: criticSystem(roleId),
      prompt: criticPrompt({
        job: input.job,
        instructions: input.instructions,
        draftText: renderDraft(draft.sections),
        cited: refs.map((ref) => ({ ref, text: lookup.get(ref)!.text })),
        findings,
      }),
      schema: critiqueSchema,
      thinking: this.settings.critic.thinking,
      temperature: 0,
      maxOutputTokens: 2500,
      userId: input.userId,
    });
    return data;
  }

  /** Turns the final draft into the stored resume, deleting anything the checks still reject. */
  private assemble(
    input: GenerateInput,
    pool: { entry: EvidenceCandidate; ref: string }[],
    lookup: Map<string, PoolEntry>,
    raw: DraftOutput,
    draft: Numbered,
    findings: Finding[],
    critique: Critique | null,
    revisions: number,
  ): ResumeDraft {
    const rejected = new Set(findings.filter((finding) => finding.severity === 'blocking').map((finding) => finding.bullet));
    const byRef = new Map(pool.map(({ entry, ref }) => [ref, entry]));
    const limit = lengthLimit(input.length);

    const evidenceRefs: ResumeContent['evidenceRefs'] = {};
    const usedEvidenceIds: string[] = [];
    let kept = 0;
    let removed = 0;
    let groupCount = 0;

    const sections: ResumeSection[] = [];
    const summary = raw.summary.trim();
    if (summary) sections.push({ id: 's-summary', heading: 'Summary', kind: 'text', text: summary });

    for (const section of draft.sections) {
      const groups: ResumeGroup[] = [];
      for (const group of section.groups) {
        const bullets: Bullet[] = [];
        for (const bullet of group.bullets) {
          if (rejected.has(bullet.id)) {
            removed += 1;
            continue;
          }
          if (kept >= limit) continue;
          const refs = bullet.evidence.filter((ref) => byRef.has(ref));
          for (const ref of refs) {
            const entry = byRef.get(ref)!;
            if (!evidenceRefs[entry.id]) {
              usedEvidenceIds.push(entry.id);
              evidenceRefs[entry.id] = { id: entry.id, source: entry.source, where: entry.where, date: entry.date, original: entry.claimText };
            }
          }
          kept += 1;
          bullets.push({
            id: bullet.id,
            text: bullet.text,
            evidence: refs.map((ref) => byRef.get(ref)!.id),
            ...(bullet.needsNumber ? { needsNumber: true } : {}),
          });
        }
        if (bullets.length) {
          groups.push({ id: `g${++groupCount}`, ...(group.title ? { title: group.title } : {}), ...(group.year ? { year: group.year } : {}), bullets });
        }
      }
      if (groups.length) sections.push({ id: `s${sections.length + 1}`, heading: section.heading, kind: 'groups', groups });
    }

    const skills = supportedSkills(raw.skills, lookup);
    if (skills.length) sections.push({ id: `s${sections.length + 1}`, heading: 'Skills', kind: 'text', text: skills.join(', ') });

    const unresolved = [
      ...findings.filter((finding) => finding.severity === 'soft').map((finding) => ({ bullet: finding.bullet as string | null, reason: finding.reason })),
      ...(critique?.verdict === 'revise' ? critique.issues.map((issue) => ({ bullet: issue.bullet, reason: issue.reason })) : []),
    ];
    const review: DraftReview = {
      score: critique ? Math.round(critique.score) : null,
      revisions,
      unresolved,
      removedBullets: removed,
      uncoveredRequirements: requirementGaps(input.job.required, lookup, allBullets(draft)),
    };

    return {
      content: {
        header: { name: input.person.name, details: headerDetails(input.person, getTemplate(input.templateId).details) },
        templateId: input.templateId,
        layout: null,
        sections,
        evidenceRefs,
      },
      usedEvidenceIds,
      review,
    };
  }

  // ─── CV review ─────────────────────────────────────────────────────────────

  async reviewCv(input: { text: string; file: string | null; roleId: RoleId | null }): ReturnType<AiEngine['reviewCv']> {
    const { data } = await this.llm.json({
      purpose: 'check',
      model: this.settings.critic.model,
      system: reviewSystem(input.roleId),
      prompt: `<cv>\n${input.text.slice(0, TEXT_LIMITS.cv)}\n</cv>`,
      schema: cvReviewSchema,
      thinking: this.settings.critic.thinking,
      temperature: 0.2,
      maxOutputTokens: 3000,
    });
    const issues: CvReviewView['issues'] = data.issues.map((issue) => ({
      title: issue.title,
      body: issue.body,
      // A quote the model made up is worse than none: keep it only if it is really in the CV.
      ...(issue.quote && input.text.includes(issue.quote) ? { quote: issue.quote } : {}),
      ...(issue.fix ? { fix: issue.fix } : {}),
    }));
    return { file: input.file, roleFamily: input.roleId, stats: cvStats(input.text), issues, engine: this.name };
  }
}
