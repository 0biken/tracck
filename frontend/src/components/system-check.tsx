'use client'

import { useState } from 'react'
import { JobProgress } from '@/components/job-progress'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { accessToken } from '@/lib/use-job'

/**
 * Development tool: starts a job that does nothing, to check the path from the
 * API through the queue and worker and back to this page.
 */
export function SystemCheck({ apiUrl }: { apiUrl: string }) {
  const [jobId, setJobId] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [failed, setFailed] = useState(false)

  async function start() {
    setStarting(true)
    setFailed(false)
    try {
      const response = await fetch(`${apiUrl}/v1/diagnostic-jobs`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${await accessToken()}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: '{}',
      })
      if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
      setJobId(((await response.json()) as { jobId: string }).jobId)
    } catch {
      setFailed(true)
    } finally {
      setStarting(false)
    }
  }

  return (
    <section className="border border-line bg-canvas p-4">
      <h2 className="t-claim">Background jobs check</h2>
      <p className="mt-1 max-w-[62ch] text-ink-muted">
        Shown in development only. Starts a test job to confirm the API, queue, and worker are
        connected.
      </p>

      <div className="mt-4 flex flex-col gap-4">
        {failed && (
          <Alert tone="danger" title="We could not start the test job">
            Check that the API is running and that test jobs are enabled, then try again.
          </Alert>
        )}
        <div>
          <Button variant="secondary" loading={starting} onClick={start}>
            Start test job
          </Button>
        </div>
        {jobId && <JobProgress key={jobId} apiUrl={apiUrl} jobId={jobId} title="Test job" />}
      </div>
    </section>
  )
}
