// The AI engine boundary. Everything that needs a model (reading sources into
// evidence, reading a job, writing and checking a resume, reviewing a CV) goes
// through this one interface, so the engine can be designed later without
// touching the rest of the API. Today the only implementation is a placeholder.

import type { CvReviewView, MatchReport, PersonDetails, ResumeContent, ResumeLength, RoleId, SourceProvider } from '@tracck/shared';

/** One piece of source material to read: a repository, a page, a CV, pasted text. */
export interface SourceDocument {
  id: string;
  provider: SourceProvider;
  /** What it is: github_repo, github_contribution, uploaded_cv, linkedin_profile, portfolio_page, pasted_text, ... */
  kind: string;
  title: string | null;
  text: string;
  url: string | null;
  date: Date | null;
  /** For example the repository name or the file name. */
  where: string | null;
  projectKey?: string | null;
  skillsHint?: string[];
}

export type EvidenceType =
  | 'skill'
  | 'project'
  | 'role'
  | 'achievement'
  | 'metric'
  | 'education'
  | 'certification'
  | 'responsibility'
  | 'publication'
  | 'leadership';

export interface ExtractedEvidence {
  evidenceType: EvidenceType;
  title: string;
  claimText: string;
  skills: string[];
  /** Themes the entry shows (leadership, performance...), used to find it again for a given emphasis. */
  topics?: string[];
  projectKey: string | null;
  validFrom: Date | null;
  where: string | null;
}

export interface JobReading {
  required: string[];
  preferred: string[];
  roleId: RoleId | null;
  seniority?: 'entry' | 'mid' | 'senior' | null;
  /** What the employer cares about; matched against entry tags when retrieving. */
  themes?: string[];
}

/** An entry as the writer sees it. */
export interface EvidenceCandidate {
  id: string;
  title: string;
  claimText: string;
  evidenceType: EvidenceType;
  skills: string[];
  topics: string[];
  projectKey: string | null;
  source: 'GITHUB' | 'CV' | 'LINKEDIN' | 'PORTFOLIO' | 'X' | 'MANUAL';
  where: string | null;
  date: string | null;
  pinned: boolean;
}

export interface GenerateInput {
  /** For cost records. Not sent to the model. */
  userId?: string;
  person: PersonDetails;
  job: JobReading & { title: string; company: string | null; description: string };
  focus: string | null;
  /** What the person asked for, in their words. Guides the choices; never adds facts. */
  instructions: string | null;
  length: ResumeLength;
  roleId: RoleId | null;
  templateId: string;
  evidence: EvidenceCandidate[];
}

export interface DraftReview {
  /** The critic's score for the final draft, 0 to 100. */
  score: number | null;
  /** Times the critic sent the draft back to the writer. */
  revisions: number;
  /** Problems still open when the loop ended. */
  unresolved: { bullet: string | null; reason: string }[];
  /** Bullets removed because their figures or tools were not in the cited evidence. */
  removedBullets: number;
  uncoveredRequirements: string[];
}

export interface ResumeDraft {
  content: ResumeContent;
  review?: DraftReview;
  /** Which entries the draft drew on, in order of use. */
  usedEvidenceIds: string[];
}

export interface AiEngine {
  /** "placeholder" until a real engine exists. Stored with every result. */
  readonly name: string;
  extractEvidence(document: SourceDocument): Promise<ExtractedEvidence[]>;
  parseJob(description: string): Promise<JobReading>;
  generateResume(input: GenerateInput): Promise<ResumeDraft>;
  reviewCv(input: { text: string; file: string | null; roleId: RoleId | null }): Promise<Omit<CvReviewView, 'id' | 'readAt'>>;
}

export type { MatchReport };
