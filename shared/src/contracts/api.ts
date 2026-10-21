// Response and request shapes of the product API. Types only: the API checks
// requests with zod, and the frontend uses these to read responses. Dates are
// ISO 8601 strings in UTC and numbers are raw; screens format them.

import type { CheckoutPlan, KeyScope, PlanId, PriceTier, RoleId } from './catalog';

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
  roles: RoleId[];
  primaryRole: RoleId | null;
  plan: PlanId;
  priceTier: PriceTier | null;
  studentVerified: boolean;
  onboardingCompleted: boolean;
  policyAccepted: boolean;
  preferences: Preferences;
}

export interface UpdateMeRequest {
  name?: string;
  headline?: string | null;
  location?: string | null;
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

export interface GraphProject {
  id: string;
  name: string;
  count: number;
  period: { from: string | null; to: string | null };
  sources: number;
  summary: string | null;
  skills: string[];
  usedInResumes: number;
  pinned: boolean;
  entries: { date: string | null; source: EntrySource; text: string }[];
  more: number;
}

export interface GraphView {
  entries: number;
  updatedAt: string | null;
  months: { month: string; count: number }[];
  projects: GraphProject[];
  moreProjects: number;
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
  title?: string;
  year?: string;
  bullets: Bullet[];
}

export type ResumeSection =
  | { id: string; heading: string; kind: 'text'; text: string }
  | { id: string; heading: string; kind: 'groups'; groups: ResumeGroup[] };

export interface ResumeContent {
  header: { name: string; contact: string };
  sections: ResumeSection[];
  evidenceRefs: Record<string, EvidenceRef>;
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
  priceTier: PriceTier | null;
  status: 'active' | 'trialing' | 'past_due' | 'cancelled' | 'expired' | 'none';
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  usage: { resumes: number; resumesLimit: number | null; sources: number; sourcesLimit: number | null; resetsOn: string };
  studentVerified: boolean;
  studentEmail: string | null;
  paymentsConfigured: boolean;
}

export interface CheckoutRequest {
  plan: CheckoutPlan;
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

export interface StudentVerificationRequest {
  email: string;
}

// ─── Consent (the person's side) ─────────────────────────────────────────────

export interface ConsentRequestView {
  orgName: string;
  scopes: { id: KeyScope; label: string }[];
  status: 'pending' | 'granted' | 'denied' | 'expired';
  requestedAt: string;
  expiresAt: string;
}

export interface GrantConsentRequest {
  scopes: KeyScope[];
}

export interface GrantedConsentView {
  id: string;
  orgName: string;
  scopes: KeyScope[];
  grantedAt: string;
}

export interface ConsentsView {
  granted: GrantedConsentView[];
  requested: { token: string; orgName: string; scopes: KeyScope[] }[];
}

// ─── Staff console and organisation API ──────────────────────────────────────

export interface ClientView {
  id: string;
  name: string;
  status: 'pending' | 'active' | 'suspended';
  contactEmail: string | null;
  monthlyQuota: number;
  createdAt: string;
}

export type KeyState = 'active' | 'rotating' | 'revoked';

export interface ApiKeyView {
  id: string;
  label: string;
  mode: 'live' | 'test';
  /** For example "trk_live_8f2a…". The secret is never shown again. */
  display: string;
  scopes: KeyScope[];
  rateLimitPerMin: number;
  monthlyQuota: number | null;
  lastUsedAt: string | null;
  lastUsedIp: string | null;
  expiresAt: string | null;
  stopsAt: string | null;
  revokedAt: string | null;
  state: KeyState;
  createdAt: string;
}

export interface CreateKeyRequest {
  label: string;
  mode: 'live' | 'test';
  scopes: KeyScope[];
  rateLimitPerMin?: number;
  monthlyQuota?: number | null;
  /** Days until it expires; omit for never. */
  expiresInDays?: number | null;
}

export interface CreatedKeyResponse {
  key: ApiKeyView;
  /** Shown once. */
  secret: string;
}

export interface UsageView {
  period: { from: string; to: string };
  client: ClientView;
  resumesGenerated: number;
  quota: number;
  apiRequests: number;
  successRate: number;
  studentsConsented: number;
  consentsRevoked: number;
  rateLimited: number;
  perDay: number[];
  quotaUsedPercent: number;
  monthElapsedPercent: number;
  alerts: { keyPrefix: string; message: string; at: string }[];
}

export interface AuditEventView {
  at: string;
  event: string;
  keyPrefix: string | null;
  by: string | null;
  ip: string | null;
  alert: boolean;
}

export interface CreateConsentLinkRequest {
  scopes: KeyScope[];
  /** Your own reference for the person, returned with the grant. */
  externalRef?: string;
}

export interface CreateConsentLinkResponse {
  url: string;
  expiresAt: string;
}

export interface OrgProfileView {
  name: string | null;
  headline: string | null;
  location: string | null;
  roles: RoleId[];
  skills: string[];
}

export interface OrgCreateResumeRequest {
  jobDescription: string;
  length: ResumeLength;
  roleId?: RoleId;
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
