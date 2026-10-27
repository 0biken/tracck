// Job vocabulary shared by the API, the worker and the frontend.
// Names match the enums in the Technical Architecture, Revision 2 (§5.8, §7.1).

export const JOB_TYPES = [
  'source_import',
  'cv_parse',
  'cv_review',
  'profile_index',
  'resume_generation',
  'resume_export',
  'source_sync',
  'cleanup',
  'diagnostic',
  'data_export',
  'account_deletion',
  'email_send',
  'webhook_delivery',
  'weekly_digest',
] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const JOB_STATUSES = [
  'queued',
  'running',
  'retry_wait',
  'succeeded',
  'failed',
  'cancelled',
  'needs_user_action',
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_STEPS = [
  'download_source',
  'parse_cv',
  'normalize',
  'embed',
  'retrieve',
  'draft',
  'critique',
  'revise',
  'validate',
  'export',
  'notify',
] as const;
export type JobStep = (typeof JOB_STEPS)[number];

/**
 * Allowed status changes. The first eight are the lifecycle in §7.1. The rest
 * cover actions the same section describes without listing a transition:
 * cancelling a job that is waiting, the retry action on a failed job, and
 * resuming after the user resolves a `needs_user_action`.
 */
const TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  queued: ['running', 'cancelled'],
  running: ['succeeded', 'retry_wait', 'failed', 'cancelled', 'needs_user_action'],
  retry_wait: ['running', 'cancelled'],
  needs_user_action: ['queued', 'cancelled'],
  failed: ['queued'],
  succeeded: [],
  cancelled: [],
};

export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Statuses a worker may pick up. */
export const RUNNABLE_STATUSES: readonly JobStatus[] = ['queued', 'retry_wait'];

/** Statuses that can be cancelled without a worker's cooperation. */
export const WAITING_STATUSES: readonly JobStatus[] = ['queued', 'retry_wait', 'needs_user_action'];

/** Nothing further happens to a job in one of these unless the user retries it. */
export const SETTLED_STATUSES: readonly JobStatus[] = ['succeeded', 'failed', 'cancelled'];

export function isSettled(status: JobStatus): boolean {
  return SETTLED_STATUSES.includes(status);
}

export interface JobRecord {
  id: string;
  userId: string;
  jobType: JobType;
  status: JobStatus;
  step: JobStep | null;
  progressPercent: number | null;
  attemptCount: number;
  maxAttempts: number;
  idempotencyKey: string;
  inputRef: Record<string, unknown>;
  resultRef: Record<string, unknown> | null;
  errorCode: string | null;
  safeErrorMessage: string | null;
  correlationId: string | null;
  enqueueError: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  heartbeatAt: string | null;
  completedAt: string | null;
  cancelRequestedAt: string | null;
}

/** What the API returns for a job. Internal fields stay on the server. */
export interface JobView {
  id: string;
  type: JobType;
  status: JobStatus;
  step: JobStep | null;
  progressPercent: number | null;
  attemptCount: number;
  maxAttempts: number;
  error: { code: string; message: string } | null;
  result: Record<string, unknown> | null;
  cancelRequested: boolean;
  canCancel: boolean;
  canRetry: boolean;
  version: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export function toJobView(job: JobRecord): JobView {
  return {
    id: job.id,
    type: job.jobType,
    status: job.status,
    step: job.step,
    progressPercent: job.progressPercent,
    attemptCount: job.attemptCount,
    maxAttempts: job.maxAttempts,
    error: job.errorCode
      ? { code: job.errorCode, message: job.safeErrorMessage ?? 'Something went wrong with this job.' }
      : null,
    result: job.resultRef,
    cancelRequested: job.cancelRequestedAt !== null,
    canCancel: !isSettled(job.status) && job.cancelRequestedAt === null,
    canRetry: job.status === 'failed',
    version: job.version,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
  };
}

/** One row of a person's recent background work, newest first. */
export interface JobListItem {
  id: string;
  type: JobType;
  status: JobStatus;
  step: JobStep | null;
  progressPercent: number | null;
  attempts: number;
  maxAttempts: number;
  error: { code: string; message: string } | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}
