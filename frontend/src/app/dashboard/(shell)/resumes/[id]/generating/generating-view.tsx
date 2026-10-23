'use client'

import { Check, CircleAlert } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { JobStep, JobView, ResumeDetailView } from '@tracck/shared'
import { Eyebrow } from '@/components/page-header'
import { ErrorNotice } from '@/components/sources/dialogs'
import { Button, buttonClass } from '@/components/ui/button'
import { api } from '@/lib/api/client'
import { apiBase } from '@/lib/api/transport'
import { formatDate } from '@/lib/format'
import { useJob } from '@/lib/use-job'

/** The steps the writer goes through, in order. Each is done when the job has moved past it. */
const STEPS: { step: JobStep; title: string; done: string }[] = [
  { step: 'retrieve', title: 'Reading the job and finding your evidence', done: 'The entries that match this job were chosen' },
  { step: 'draft', title: 'Writing', done: 'Every bullet is written from an entry of yours' },
  { step: 'validate', title: 'Checking every claim against your entries', done: 'Each figure and tool traces to your evidence' },
]

/** Where a job stands: how many steps are complete and which one is running. */
function progressOf(job: JobView | null) {
  if (job?.status === 'succeeded') return { done: STEPS.length, finished: true }
  const index = STEPS.findIndex((item) => item.step === job?.step)
  // Before the first step is reported the job is queued, and the first step is the one waiting.
  return { done: Math.max(index, 0), finished: false }
}

export function GeneratingView({ resume, eyebrow }: { resume: ResumeDetailView; eyebrow: string }) {
  const ready = resume.status === 'draft' || resume.status === 'exported'

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,440px),1fr))] items-start gap-12">
      <section className="flex min-w-0 flex-col gap-7">
        {resume.status === 'generating' && resume.jobId ? (
          <Live resume={resume} eyebrow={eyebrow} jobId={resume.jobId} />
        ) : (
          <Settled resume={resume} eyebrow={eyebrow} ready={ready} />
        )}
      </section>

      <section className="flex min-w-0 flex-col gap-4" aria-label="Evidence being used">
        <Evidence resume={resume} />
      </section>
    </div>
  )
}

function Heading({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="t-h2 m-0">{title}</h1>
      <p className="m-0 text-[17px] leading-[26px] text-ink-muted">{children}</p>
    </div>
  )
}

/** A resume that is being written: follows its job. */
function Live({ resume, eyebrow, jobId }: { resume: ResumeDetailView; eyebrow: string; jobId: string }) {
  const router = useRouter()
  const { job, unreachable } = useJob(apiBase(), jobId)
  const { done, finished } = progressOf(job)
  const status = job?.status
  const stopped = status === 'failed' || status === 'cancelled' || status === 'needs_user_action'

  useEffect(() => {
    // The page reads the finished resume from the server.
    if (status === 'succeeded') router.refresh()
  }, [status, router])

  if (stopped) {
    return (
      <Failure
        resumeId={resume.id}
        eyebrow={eyebrow}
        message={job?.error?.message ?? 'We could not write this resume.'}
        needsEvidence={job?.error?.code === 'NO_EVIDENCE'}
      />
    )
  }

  return (
    <>
      <Heading eyebrow={eyebrow} title={finished ? 'Your draft is ready' : 'Writing your resume'}>
        You can stay or leave. This screen updates when the draft is ready, and it is saved under Resumes either way.
      </Heading>

      <ol className="m-0 list-none border-t-2 border-ink p-0">
        {STEPS.map((item, index) => {
          const complete = index < done
          const current = index === done && !finished
          return (
            <li
              key={item.step}
              aria-current={current ? 'step' : undefined}
              className={`grid grid-cols-[40px_minmax(0,1fr)] items-center gap-4 border-b py-[18px] ${
                current ? 'border-line-strong bg-sunken px-3' : 'border-line'
              } ${!complete && !current ? 'text-ink-muted' : ''}`}
            >
              <span
                className={`grid size-7 place-items-center font-mono text-xs ${
                  complete ? 'bg-signal text-on-signal' : current ? 'border-2 border-ink font-medium' : 'border border-line-input'
                }`}
              >
                {complete ? <Check className="size-4" strokeWidth={2.5} aria-hidden="true" /> : index + 1}
              </span>
              <div>
                <div className={current ? 'font-bold' : 'font-semibold'}>{item.title}</div>
                {current && <div className="text-sm text-ink-muted">In progress{job?.progressPercent != null ? ` · ${job.progressPercent}%` : ''}</div>}
                {complete && <div className="text-sm text-ink-muted">{item.done}</div>}
              </div>
            </li>
          )
        })}
      </ol>

      <div role="status" aria-live="polite" className="sr-only">
        {finished ? 'Your draft is ready.' : `Step ${done + 1} of ${STEPS.length}: ${STEPS[done].title}`}
      </div>

      {unreachable && (
        <p role="alert" className="m-0 text-sm text-danger-ink">
          We lost touch with the server. The resume is still being written; this page will catch up when it is back.
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Link href="/dashboard" className={buttonClass('secondary', 'md')}>
          Leave and come back later
        </Link>
        <span aria-disabled="true" className={`${buttonClass('primary', 'md')} opacity-50`}>
          Open draft
        </span>
      </div>
    </>
  )
}

/** A resume that is not being written: a finished draft, or one that failed. */
function Settled({ resume, eyebrow, ready }: { resume: ResumeDetailView; eyebrow: string; ready: boolean }) {
  if (!ready) {
    return <Failure resumeId={resume.id} eyebrow={eyebrow} message="We could not write this resume." needsEvidence={false} />
  }
  return (
    <>
      <Heading eyebrow={eyebrow} title="Your draft is ready">
        Written {formatDate(resume.savedAt)}. Open it to check each bullet against the entry behind it.
      </Heading>
      <ol className="m-0 list-none border-t-2 border-ink p-0">
        {STEPS.map((item) => (
          <li key={item.step} className="grid grid-cols-[40px_minmax(0,1fr)] items-center gap-4 border-b border-line py-[18px]">
            <span className="grid size-7 place-items-center bg-signal text-on-signal">
              <Check className="size-4" strokeWidth={2.5} aria-hidden="true" />
            </span>
            <div>
              <div className="font-semibold">{item.title}</div>
              <div className="text-sm text-ink-muted">{item.done}</div>
            </div>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-3">
        <Link href="/dashboard" className={buttonClass('secondary', 'md')}>
          Go to home
        </Link>
        <Link href={`/dashboard/resumes/${resume.id}`} className={buttonClass('primary', 'md')}>
          Open draft
        </Link>
      </div>
    </>
  )
}

function Failure({ resumeId, eyebrow, message, needsEvidence }: { resumeId: string; eyebrow: string; message: string; needsEvidence: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  async function retry() {
    setBusy(true)
    setError(null)
    try {
      await api.resumes.regenerate(resumeId)
      router.refresh()
    } catch (failure) {
      setError(failure)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Heading eyebrow={eyebrow} title="This resume could not be written">
        Nothing was used from your plan for this attempt.
      </Heading>
      <div role="alert" className="flex items-start gap-3 border border-danger bg-danger-tint p-4">
        <CircleAlert className="mt-0.5 size-5 shrink-0 text-danger-ink" strokeWidth={2} aria-hidden="true" />
        <span className="text-[15px] leading-[22px]">{message}</span>
      </div>
      {error !== null && <ErrorNotice error={error} />}
      <div className="flex flex-wrap gap-3">
        {needsEvidence ? (
          <Link href="/dashboard/sources" className={buttonClass('primary', 'md')}>
            Connect a source
          </Link>
        ) : (
          <Button loading={busy} onClick={retry}>
            Try again
          </Button>
        )}
        <Link href="/dashboard/resumes" className={buttonClass('secondary', 'md')}>
          Back to resumes
        </Link>
      </div>
    </>
  )
}

function Evidence({ resume }: { resume: ResumeDetailView }) {
  const refs = Object.values(resume.content?.evidenceRefs ?? {})
  if (refs.length === 0) {
    return (
      <>
        <Eyebrow>Evidence being used</Eyebrow>
        <p className="m-0 border-t border-line pt-4 text-[15px] leading-[22px] text-ink-muted">
          The entries this resume is written from show up here once the job has been read.
        </p>
      </>
    )
  }
  return (
    <>
      <Eyebrow>Evidence used · {refs.length} entries</Eyebrow>
      <div className="border-t border-line">
        {refs.slice(0, 6).map((item) => (
          <div key={item.id} className="flex flex-col gap-1 border-b border-line py-3.5">
            <span className="font-mono text-xs text-ink-muted">
              {item.source}
              {item.where && ` · ${item.where}`}
            </span>
            <span className="text-[15px] leading-[22px]">{item.original}</span>
          </div>
        ))}
        {refs.length > 6 && <div className="py-3.5 font-mono text-xs text-ink-muted">+ {refs.length - 6} more</div>}
      </div>
    </>
  )
}
