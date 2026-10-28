// What the models are asked to return. Each schema is sent to the provider as JSON
// Schema and checked again with zod. Keep them small: every field costs output tokens.

import { z } from 'zod';
import { ROLE_IDS } from '@tracck/shared';

const roleId = z.enum(ROLE_IDS);

export const EVIDENCE_TYPES = [
  'skill',
  'project',
  'role',
  'achievement',
  'metric',
  'education',
  'certification',
  'responsibility',
  'publication',
  'leadership',
] as const;

export const extractionSchema = z.object({
  entries: z
    .array(
      z.object({
        evidenceType: z.enum(EVIDENCE_TYPES),
        title: z.string().describe('A short label, under 90 characters.'),
        claimText: z
          .string()
          .describe('One self-contained statement using only facts in the source. Keep every number and name exactly as written.'),
        skills: z.array(z.string()).describe('Tools, languages and methods the statement names.'),
        topics: z
          .array(z.string())
          .describe('Themes the statement shows, lower case: leadership, performance, mentoring, scale, testing, growth, research...'),
        projectKey: z
          .string()
          .nullable()
          .describe('Only for evidenceType project (the project name) or role (the employer name). Otherwise null. Never a file name.'),
        date: z.string().nullable().describe('YYYY-MM-DD or YYYY-MM if the source dates it, else null.'),
      }),
    )
    // No maxItems here: Gemini rejects the schema (400) when it is combined with these item fields.
    // The engine caps the entries it keeps per document.
});
export type Extraction = z.infer<typeof extractionSchema>;

export const jobReadingSchema = z.object({
  required: z.array(z.string()).describe('Skills, tools and qualifications the job demands.'),
  preferred: z.array(z.string()).describe('Nice-to-have skills and qualifications.'),
  roleId: roleId.nullable(),
  seniority: z.enum(['entry', 'mid', 'senior']).nullable(),
  /** Themes the employer cares about, lower case. Used to pick matching evidence. */
  themes: z.array(z.string()),
});
export type JobReadingOutput = z.infer<typeof jobReadingSchema>;

const bulletSchema = z.object({
  text: z.string(),
  evidence: z.array(z.string()).describe('Refs such as E3 for every entry this bullet draws on.'),
  needsNumber: z.boolean().optional().describe('True when the bullet implies a measurable result the evidence gives no figure for.'),
});

export const draftSchema = z.object({
  summary: z.string().describe('Two or three sentences. No first person. No claim that is not in the evidence.'),
  skills: z.array(z.string()).describe('Skills named in the evidence, most relevant to the job first.'),
  sections: z.array(
    z.object({
      heading: z.string(),
      groups: z.array(
        z.object({
          title: z.string().optional().describe('Project, employer or programme name.'),
          year: z.string().optional(),
          bullets: z.array(bulletSchema),
        }),
      ),
    }),
  ),
});
export type DraftOutput = z.infer<typeof draftSchema>;

export const FINDING_KINDS = ['unsupported', 'irrelevant', 'weak', 'vague', 'tone', 'role_rule', 'repetition', 'missing_requirement'] as const;

export const critiqueSchema = z.object({
  verdict: z.enum(['pass', 'revise']),
  score: z.number().min(0).max(100).describe('How close this is to the best resume for this job from this evidence.'),
  issues: z.array(
    z.object({
      bullet: z.string().nullable().describe('The bullet id, or null for a problem with the resume as a whole.'),
      kind: z.enum(FINDING_KINDS),
      reason: z.string(),
      fix: z.string().describe('What the writer should do, in one sentence.'),
    }),
  ),
  uncoveredRequirements: z.array(z.string()).describe('Required skills the evidence could support but the resume does not show.'),
});
export type Critique = z.infer<typeof critiqueSchema>;

/** The formatter's choices. Anything it names that the resume does not have is dropped. */
export const layoutChoiceSchema = z.object({
  experienceGroupIds: z.array(z.string()).max(30),
  educationGroupIds: z.array(z.string()).max(10),
  skills: z.array(z.string()).max(10),
  strengths: z.array(z.string()).max(6),
});
export type LayoutChoice = z.infer<typeof layoutChoiceSchema>;

export const cvReviewSchema = z.object({
  stats: z.array(z.object({ n: z.number(), label: z.string() })).max(4),
  issues: z
    .array(
      z.object({
        title: z.string(),
        body: z.string(),
        quote: z.string().optional().describe('The exact words from the CV the issue is about.'),
        fix: z.string().optional(),
      }),
    )
    .max(8),
});
export type CvReviewOutput = z.infer<typeof cvReviewSchema>;
