'use client'

import {
  Check,
  CircleMinus,
  CircleX,
  Clock,
  LoaderCircle,
  RefreshCw,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { JOB_STATUS_BADGES, STEP_LABELS, type BadgeIcon, type JobStep } from '@tracck/shared'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { accessToken, useJob } from '@/lib/use-job'

const icons: Record<BadgeIcon, LucideIcon> = {
  clock: Clock,
  loader: LoaderCircle,
  refresh: RefreshCw,
  check: Check,
  'circle-x': CircleX,
  'circle-minus': CircleMinus,
  alert: TriangleAlert,
}

/**
 * Shows the real step reported by the server, never a timer (design system,
 * "Job progress"). Screen readers hear step changes, not every percent.
 */
export function JobProgress({ apiUrl, jobId, title }: { apiUrl: string; jobId: string; title: string }) {
  const { job, unreachable } = useJob(apiUrl, jobId)
  const [seenSteps, setSeenSteps] = useState<JobStep[]>([])
  const [cancelling, setCancelling] = useState(false)

  // Remember each step as it is reported, so finished steps stay on screen.
  if (job?.step && !seenSteps.includes(job.step)) setSeenSteps([...seenSteps, job.step])

  if (!job) {
    return (
      <div className="border border-line bg-canvas p-4">
        {unreachable ? (
          <Alert tone="warning" title="We cannot reach the server">
            The job keeps running. We will keep trying to load its status.
          </Alert>
        ) : (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-5 w-2/5" />
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        )}
      </div>
    )
  }

  const badge = JOB_STATUS_BADGES[job.status]
  const working = job.status === 'running'
  const percent = job.progressPercent ?? 0

  async function cancel() {
    setCancelling(true)
    try {
      await fetch(`${apiUrl}/v1/jobs/${jobId}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${await accessToken()}` },
      })
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="max-w-130 border border-line bg-canvas p-4">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <b className="font-semibold">{title}</b>
          <div className="font-mono text-[13px] text-ink-muted">{job.id}</div>
        </div>
        <Badge tone={badge.tone} icon={icons[badge.icon]} spin={working}>
          {badge.label}
        </Badge>
      </div>

      <div
        role="progressbar"
        aria-label="Job progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-1.5 overflow-hidden bg-sunken-2"
      >
        <div
          className="h-full bg-ink transition-[width] duration-200 ease-standard"
          style={{ width: `${percent}%` }}
        />
      </div>

      {seenSteps.length > 0 && (
        <ol className="mt-2.5 flex flex-col gap-1">
          {seenSteps.map((step) => {
            const current = working && step === job.step
            const Icon = current ? LoaderCircle : Check
            return (
              <li key={step} className={`flex items-center gap-2 text-sm ${current ? '' : 'text-ink-muted'}`}>
                <Icon
                  className={`size-4 ${current ? 'animate-spin text-ink' : 'text-signal'}`}
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                {STEP_LABELS[step]}
              </li>
            )
          })}
        </ol>
      )}

      {job.error && (
        <div className="mt-3">
          <Alert tone={job.status === 'failed' ? 'danger' : 'warning'} title={badge.label}>
            {job.error.message}
          </Alert>
        </div>
      )}

      {job.canCancel && (
        <>
          <p className="mb-3 mt-1.5 text-[13px] text-ink-muted">
            You can leave this page. The job keeps running.
          </p>
          <Button variant="ghost" size="sm" loading={cancelling} onClick={cancel}>
            Cancel job
          </Button>
        </>
      )}

      <div className="sr-only" role="status">
        {working && job.step ? STEP_LABELS[job.step] : badge.label}
      </div>
    </div>
  )
}
