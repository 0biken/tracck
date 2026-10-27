'use client'

import { useCallback, useEffect, useState } from 'react'
import type { JobListItem, JobStatus, JobStep, JobType } from '@tracck/shared'
import { ErrorNotice } from '@/components/sources/dialogs'
import { Tag } from '@/components/ui/badge'
import { ScrollTable, tdClass, thClass } from '@/components/ui/table'
import { api } from '@/lib/api/client'
import { formatStamp } from '@/lib/format'

const POLL_MS = 3_000

const ACTIVE: readonly JobStatus[] = ['queued', 'running', 'retry_wait']
const SHOWS_PROGRESS: readonly JobStatus[] = ['queued', 'running', 'retry_wait']
const SHOWS_ERROR: readonly JobStatus[] = ['retry_wait', 'failed', 'needs_user_action']

// Partial, so a type the API adds later falls back to its raw name below.
const JOB_LABEL: Partial<Record<JobType, string>> = {
  source_import: 'Reading a source',
  source_sync: 'Refreshing a source',
  cv_parse: 'Reading a CV',
  cv_review: 'Reviewing a CV',
  resume_generation: 'Writing a resume',
  resume_export: 'Exporting a file',
  profile_index: 'Updating search index',
  email_send: 'Sending an email',
  data_export: 'Preparing your data',
  account_deletion: 'Deleting account',
  weekly_digest: 'Weekly digest',
  webhook_delivery: 'Delivering a webhook',
  cleanup: 'Tidying up',
  diagnostic: 'Diagnostic',
}

const STATUS_LABEL: Record<JobStatus, { label: string; tone: 'muted' | 'ink' | 'signal' | 'danger' }> = {
  queued: { label: 'Queued', tone: 'muted' },
  running: { label: 'Running', tone: 'ink' },
  retry_wait: { label: 'Retrying', tone: 'muted' },
  needs_user_action: { label: 'Needs you', tone: 'danger' },
  succeeded: { label: 'Done', tone: 'signal' },
  failed: { label: 'Failed', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'muted' },
}

const STEP_LABEL: Partial<Record<JobStep, string>> = {
  download_source: 'Downloading',
  parse_cv: 'Reading CV',
  normalize: 'Normalising',
  embed: 'Indexing',
  retrieve: 'Gathering evidence',
  draft: 'Drafting',
  critique: 'Reviewing draft',
  revise: 'Revising',
  validate: 'Checking',
  export: 'Exporting',
  notify: 'Notifying you',
}

/**
 * Recent background jobs. It polls while any job is still moving and keeps the
 * last list on screen if a poll fails.
 */
export function BackgroundWork({ initial }: { initial: JobListItem[] }) {
  const [jobs, setJobs] = useState(initial)
  const [seen, setSeen] = useState(initial)
  const [error, setError] = useState<unknown>(null)

  // The page re-renders with a fresh `initial` after the person starts work elsewhere.
  if (initial !== seen) {
    setSeen(initial)
    setJobs(initial)
  }

  const refresh = useCallback(async () => {
    try {
      setJobs(await api.jobs.list())
      setError(null)
    } catch (caught) {
      setError(caught)
    }
  }, [])

  const active = jobs.some((job) => ACTIVE.includes(job.status))
  useEffect(() => {
    if (!active) return
    const timer = window.setInterval(refresh, POLL_MS)
    return () => window.clearInterval(timer)
  }, [active, refresh])

  return (
    <section aria-labelledby="background-work" className="mt-12">
      <h2 id="background-work" className="t-claim m-0">
        Background work
      </h2>
      <p className="mb-5 mt-2 text-[15px] text-ink-muted">
        Reading your sources and writing resumes happens here. Failed jobs show why.
      </p>

      {error !== null && jobs.length === 0 ? (
        <ErrorNotice error={error} />
      ) : jobs.length === 0 ? (
        <p className="m-0 border border-line p-6 text-center text-[15px] text-ink-muted">No background work yet.</p>
      ) : (
        <ScrollTable caption="Background work" minWidth={680}>
          <thead>
            <tr>
              <th className={thClass}>Job</th>
              <th className={thClass}>Status</th>
              <th className={thClass}>Step</th>
              <th className={thClass}>Started</th>
              <th className={thClass}>Attempts</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
          </tbody>
        </ScrollTable>
      )}
    </section>
  )
}

function JobRow({ job }: { job: JobListItem }) {
  const status = STATUS_LABEL[job.status]
  const step = job.step ? (STEP_LABEL[job.step] ?? job.step) : '—'
  const progress =
    SHOWS_PROGRESS.includes(job.status) && job.progressPercent !== null ? ` · ${job.progressPercent}%` : ''

  return (
    <tr>
      <td className={tdClass}>
        <span className="font-bold">{JOB_LABEL[job.type] ?? job.type}</span>
        {SHOWS_ERROR.includes(job.status) && job.error && (
          <div className="mt-1 text-[13px] leading-[19px] text-danger-ink">{job.error.message}</div>
        )}
      </td>
      <td className={tdClass}>
        <Tag tone={status.tone} className="uppercase">
          {status.label}
        </Tag>
      </td>
      <td className={`${tdClass} text-[13px]`}>
        {SHOWS_PROGRESS.includes(job.status) ? `${step}${progress}` : '—'}
      </td>
      <td className={`${tdClass} font-mono text-[13px]`}>{job.startedAt ? formatStamp(job.startedAt) : '—'}</td>
      <td className={`${tdClass} font-mono text-[13px]`}>{`${job.attempts} of ${job.maxAttempts}`}</td>
    </tr>
  )
}
