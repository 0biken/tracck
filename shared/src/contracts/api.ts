// Response and request shapes of the product API. Types only: the API checks
// requests with zod, and the frontend uses these to read responses. Dates are
// ISO 8601 strings in UTC and numbers are raw; screens format them.

import type { PlanId, RoleId } from './catalog';

export interface Page<T> {
  items: T[];
  /** Pass back as `cursor` for the next page; null on the last page. */
  nextCursor: string | null;
}

// ─── Me ──────────────────────────────────────────────────────────────────────

export type CvRetention = '6_months' | '12_months' | 'until_deleted';

export interface Preferences {
  notifications: { done: boolean; weekly: boolean; attention: boolean };
  cvRetention: CvRetention;
}

export interface MeView {
  id: string;
  email: string | null;
  name: string | null;
  headline: string | null;
  location: string | null;
  phone: string | null;
  address: string | null;
  /** ISO date, YYYY-MM-DD. */
  dateOfBirth: string | null;
  nationality: string | null;
  roles: RoleId[];
  primaryRole: RoleId | null;
  plan: PlanId;
  onboardingCompleted: boolean;
  policyAccepted: boolean;
  preferences: Preferences;
}

export interface UpdateMeRequest {
  name?: string;
  headline?: string | null;
  location?: string | null;
  phone?: string | null;
  address?: string | null;
  dateOfBirth?: string | null;
  nationality?: string | null;
  roles?: RoleId[];
}

export interface SummaryView {
  entries: number;
  entriesSince: { date: string; count: number } | null;
  sourcesTotal: number;
  sourcesReady: number;
  resumes: number;
  exported: number;
  lastExportedAt: string | null;
  resumesThisMonth: number;
  resumesLimit: number | null;
  periodResetsOn: string;
  projects: number;
  skills: number;
  cvWeaknesses: number | null;
  pinned: number;
  excluded: number;
  possibleDuplicates: number;
  edited: number;
  bySource: Record<SourceProvider, number>;
  lastCollectedAt: string | null;
  nextRefreshAt: string | null;
}

export interface NotificationView {
  id: string;
  template: string;
  payload: Record<string, unknown>;
  createdAt: string;
  readAt: string | null;
}

// ─── Sources ─────────────────────────────────────────────────────────────────

export type SourceProvider = 'github' | 'cv' | 'linkedin' | 'portfolio' | 'x' | 'behance' | 'manual';
export type SourceState = 'ready' | 'collecting' | 'problem';

export interface SourceView {
  id: string;
  provider: SourceProvider;
  name: string;
  /** Handle, file name or link. */
  detail: string | null;
  state: SourceState;
  entries: number;
  lastCollectedAt: string | null;
  /** Items read so far, while collecting. */
  progress: { done: number; total: number | null } | null;
  problem: string | null;
  jobId: string | null;
  createdAt: string;
}

export interface GithubConnectResponse {
  authorizeUrl: string;
}

export interface UploadSourceResponse {
  source: SourceView;
  jobId: string;
  statusUrl: string;
  eventsUrl: string;
}

export interface DeleteSourceQuery {
  entries: 'keep' | 'delete';
}

// ─── Evidence ────────────────────────────────────────────────────────────────

export type EntrySource = 'GITHUB' | 'CV' | 'LINKEDIN' | 'PORTFOLIO' | 'X' | 'MANUAL';
export type EvidenceShow = 'all' | 'pinned' | 'excluded' | 'duplicates' | 'edited';

export interface EvidenceView {
  id: string;
  /** Position in the person's record by creation, for "Entry 118". */
  number: number;
  source: EntrySource;
  /** The date the work happened, or when it was collected. */
  date: string | null;
  /** Repository, file or page the entry came from. */
  where: string | null;
  title: string;
  body: string;
  skills: string[];
  pinned: boolean;
  excluded: boolean;
  edited: boolean;
  usedInResumes: number;
  original: string;
  version: number;
}

export interface DuplicateView {
  id: string;
  a: { id: string; source: EntrySource; date: string | null; text: string };
  b: { id: string; source: EntrySource; date: string | null; text: string };
}

export interface EvidencePage extends Page<EvidenceView> {
  counts: { all: number; pinned: number; excluded: number; duplicates: number; edited: number; bySource: Record<SourceProvider, number> };
  duplicates: DuplicateView[];
}

export interface UpdateEvidenceRequest {
  pinned?: boolean;
  excluded?: boolean;
  /** New wording. Marks the entry as edited by the person. */
  body?: string;
  title?: string;
  /** Required: the version the person was looking at. */
  version: number;
}

export interface CreateEvidenceRequest {
  kind: 'experience' | 'project' | 'skill' | 'education';
  title: string;
  body: string;
  skills?: string[];
  from?: string | null;
  to?: string | null;
}

export interface ResolveDuplicateRequest {
  action: 'merge' | 'keep_both';
}

// ─── Career Graph ────────────────────────────────────────────────────────────

/** A heading (an employer, a certificate) with the entries that belong under it. */
export interface GraphGroup {
  id: string;
  name: string;
  count: number;
  period: { from: string | null; to: string | null };
  entries: { date: string | null; source: EntrySource; text: string }[];
  more: number;
}

export interface GraphProject extends GraphGroup {
  sources: number;
  summary: string | null;
  skills: string[];
  usedInResumes: number;
  pinned: boolean;
}

export interface GraphView {
  entries: number;
  updatedAt: string | null;
  months: { month: string; count: number }[];
  /** Work experience, by employer. Empty groups are left out of the page. */
  experience: GraphGroup[];
  projects: GraphProject[];
  moreProjects: number;
  /** Certifications, one group each. */
  certifications: GraphGroup[];
  skills: { name: string; count: number }[];
}

// ─── CV feedback ─────────────────────────────────────────────────────────────

export interface CvReviewView {
  id: string;
  file: string | null;
  roleFamily: RoleId | null;
  readAt: string;
  stats: { n: number; label: string }[];
  issues: { title: string; body: string; quote?: string; fix?: string }[];
  engine: string;
}

// ─── Resumes ─────────────────────────────────────────────────────────────────

export type ResumeLength = 'one_page' | 'full';
export type ResumeStatus = 'generating' | 'draft' | 'exported' | 'failed';

export interface ResumeSummaryView {
  id: string;
  company: string | null;
  title: string;
  role: RoleId | null;
  length: ResumeLength;
  score: number | null;
  createdAt: string;
  status: ResumeStatus;
  /** New entries since this draft was written. */
  newEntries: number;
  jobId: string | null;
}

export interface EvidenceRef {
  id: string;
  source: EntrySource;
  where: string | null;
  date: string | null;
  original: string;
}

export interface Bullet {
  id: string;
  text: string;
  /** IDs into `evidenceRefs`. */
  evidence: string[];
  /** The bullet implies a figure that the evidence does not contain. */
  needsNumber?: boolean;
}

export interface ResumeGroup {
  id: string;
  title?: string;
  year?: string;
  bullets: Bullet[];
}

export type ResumeSection =
  | { id: string; heading: string; kind: 'text'; text: string }
  | { id: string; heading: string; kind: 'groups'; groups: ResumeGroup[] };

/** Personal details the person gave us. A template decides which of them its resume shows. */
export interface PersonDetails {
  name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  address: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
}

/** The personal details a template can show. */
export type PersonalDetail = 'dateOfBirth' | 'nationality' | 'address' | 'phone' | 'email' | 'location';

/** How each personal detail is labelled on a resume. */
export const PERSONAL_DETAIL_LABELS: Record<PersonalDetail, string> = {
  dateOfBirth: 'Date of birth',
  nationality: 'Nationality',
  address: 'Address',
  phone: 'Phone number',
  email: 'Email address',
  location: 'Location',
};

/** The sections a template can have. The ids are fixed, so the writer and the renderer agree on them. */
export type TemplateSectionId = 'profile' | 'experience' | 'education' | 'skills' | 'strengths';

export interface TemplateSectionView {
  id: TemplateSectionId;
  heading: string;
  /** What the section is for, in one sentence. */
  purpose: string;
}

export interface SkillRating {
  name: string;
  /** 1 to 5, from how many evidence entries use the skill. */
  level: number;
}

/** What a template shows of the resume. Ids point into the resume's sections. */
export interface TemplateLayout {
  experienceGroupIds: string[];
  educationGroupIds: string[];
  skills: SkillRating[];
  strengths: string[];
}

/** One personal detail as printed on the resume. */
export interface HeaderDetail {
  label: string;
  value: string;
}

export interface ResumeContent {
  header: { name: string; details: HeaderDetail[] };
  /** Which template renders this resume. */
  templateId: string;
  layout: TemplateLayout | null;
  sections: ResumeSection[];
  evidenceRefs: Record<string, EvidenceRef>;
}

export interface TemplateView {
  id: string;
  name: string;
  description: string;
  /** Path on this API for the preview image. */
  previewUrl: string;
  isDefault: boolean;
  sections: TemplateSectionView[];
  /** The personal details this template shows, in the order it shows them. */
  details: PersonalDetail[];
}

export interface Requirement {
  label: string;
  importance: 'required' | 'preferred';
  covered: boolean;
  /** For example "4 bullets", or why it is missing. */
  detail: string;
}

export interface MatchReport {
  score: number | null;
  required: { covered: number; total: number };
  preferred: { covered: number; total: number };
  /** Percent of bullets that cite evidence the person owns. */
  claimsTraced: number;
  measurable: { withFigure: number; total: number };
  fitsOnePage: boolean | null;
  requirements: Requirement[];
  suggestions: string[];
}

export interface ResumeDetailView extends ResumeSummaryView {
  version: number;
  savedAt: string;
  content: ResumeContent | null;
  match: MatchReport | null;
  job: { description: string; focus: string | null };
  /** The writer: "placeholder" until the AI engine exists. */
  engine: string;
  exports: { pdf: boolean; docx: boolean };
}

export interface ResumeVersionView {
  id: string;
  number: number;
  createdAt: string;
  createdBy: 'ai' | 'user' | 'import';
}

export interface ParseJobRequest {
  description: string;
}

export interface ParseJobResponse {
  required: string[];
  preferred: string[];
  roleId: RoleId | null;
}

export interface CreateResumeRequest {
  jobDescription: string;
  title?: string;
  company?: string;
  focus?: string;
  length: ResumeLength;
  roleId?: RoleId;
  /** Template to render with; the default when left out. */
  templateId?: string;
  /** Anything specific the person wants on the CV, in their words. */
  instructions?: string;
  /** Source providers to draw on; empty means all ready sources. */
  sources?: SourceProvider[];
}

export interface CreateResumeResponse {
  resumeId: string;
  jobId: string;
  statusUrl: string;
  eventsUrl: string;
}

export interface EditBulletRequest {
  /** New wording. */
  text?: string;
  /** The person's own words for a missing figure, appended to the bullet. */
  figure?: string;
  /** Accept the bullet without a figure. */
  keepWithoutFigure?: boolean;
  /** The resume version the person was looking at. */
  version: number;
}

export interface ExportRequest {
  format: 'pdf' | 'docx';
}

export interface ExportResponse {
  jobId: string;
  statusUrl: string;
  eventsUrl: string;
}

export interface ExportLinkResponse {
  url: string;
  expiresAt: string;
}

// ─── Billing ─────────────────────────────────────────────────────────────────

export interface BillingView {
  plan: PlanId;
  status: 'active' | 'trialing' | 'past_due' | 'cancelled' | 'expired' | 'none';
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  usage: { resumes: number; resumesLimit: number | null; sources: number; sourcesLimit: number | null; resetsOn: string };
  paymentsConfigured: boolean;
}

export interface CheckoutRequest {
  /** Where Paystack sends the person back to. Must be on the app origin. */
  returnPath?: string;
}

export interface CheckoutResponse {
  authorizationUrl: string;
  reference: string;
}

export interface VerifyPaymentResponse {
  status: 'succeeded' | 'pending' | 'failed';
  plan: PlanId;
}

// ─── Public ──────────────────────────────────────────────────────────────────

export interface WaitlistRequest {
  orgName: string;
  contactName: string;
  email: string;
  orgType: 'university' | 'bootcamp' | 'job_platform' | 'other';
  volume?: string;
  message?: string;
}

