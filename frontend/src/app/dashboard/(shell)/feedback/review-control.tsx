'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ErrorNotice } from '@/components/sources/dialogs'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api/client'
import { ApiClientError } from '@/lib/api/errors'
import { apiBase } from '@/lib/api/transport'
import { useJob } from '@/lib/use-job'

/** Starts a CV review and follows it. When it finishes the page reads the new review. */
export function ReviewControl({ label }: { label: string }) {
  const [jobId, setJobId] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<unknown>(null)

  async function start() {
    setStarting(true)
    setError(null)
    try {
      setJobId((await api.cvReview.request()).jobId)
    } catch (failure) {
      setError(failure)
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Button variant="secondary" loading={starting || jobId !== null} onClick={start}>
          {jobId ? 'Reading your CV' : label}
        </Button>
      </div>
      {jobId && <Following jobId={jobId} onDone={() => setJobId(null)} onError={setError} />}
      {error !== null && <ErrorNotice error={error} />}
    </div>
  )
}

function Following({ jobId, onDone, onError }: { jobId: string; onDone: () => void; onError: (error: unknown) => void }) {
  const router = useRouter()
  const { job } = useJob(apiBase(), jobId)
  const status = job?.status

  useEffect(() => {
    if (status === 'succeeded') {
      router.refresh()
      onDone()
    } else if (status === 'failed' || status === 'cancelled') {
      onError(new ApiClientError(422, job?.error?.code ?? 'JOB_FAILED', job?.error?.message ?? 'We could not review your CV. Try again.'))
      onDone()
    }
  }, [status, job, router, onDone, onError])

  return (
    <p role="status" className="m-0 font-mono text-xs text-ink-muted">
      {job?.progressPercent != null ? `${job.progressPercent}% · ` : ''}
      READING…
    </p>
  )
}
