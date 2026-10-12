// User-facing words for job state. Source: docs/design/tracck-design-system.html,
// "Status badge" and "Job step labels". The progress list never shows internal names.

import type { JobStatus, JobStep } from './jobs';

export const STEP_LABELS: Record<JobStep, string> = {
  download_source: 'Fetching your records',
  parse_cv: 'Reading your CV',
  normalize: 'Organizing what we found',
  embed: 'Indexing your entries',
  retrieve: 'Matching entries to the role',
  draft: 'Drafting your resume',
  critique: 'Checking quality',
  revise: 'Improving the draft',
  validate: 'Verifying every claim has a source',
  export: 'Preparing PDF and Word files',
  notify: 'Done. Sending your email.',
};

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

/** Icon names are Lucide icon names. */
export type BadgeIcon = 'clock' | 'loader' | 'refresh' | 'check' | 'circle-x' | 'circle-minus' | 'alert';

export const JOB_STATUS_BADGES: Record<JobStatus, { label: string; tone: BadgeTone; icon: BadgeIcon }> = {
  queued: { label: 'Queued', tone: 'neutral', icon: 'clock' },
  running: { label: 'Working', tone: 'accent', icon: 'loader' },
  retry_wait: { label: 'Retrying shortly', tone: 'warning', icon: 'refresh' },
  succeeded: { label: 'Ready', tone: 'success', icon: 'check' },
  failed: { label: 'Failed', tone: 'danger', icon: 'circle-x' },
  cancelled: { label: 'Cancelled', tone: 'neutral', icon: 'circle-minus' },
  needs_user_action: { label: 'Needs your input', tone: 'warning', icon: 'alert' },
};
