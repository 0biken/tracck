'use client'

import { useEffect, useState } from 'react'
import { isSettled, type JobView } from '@tracck/core'
import { createClient } from '@/utils/supabase/client'

const POLL_MS = 3_000

export async function accessToken(): Promise<string> {
  const { data } = await createClient().auth.getSession()
  if (!data.session) throw new Error('Not signed in')
  return data.session.access_token
}

/** Pulls complete `data:` payloads out of a server-sent event stream as it arrives. */
async function readJobEvents(body: ReadableStream<Uint8Array>, onJob: (job: JobView) => void) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) return
    buffer += decoder.decode(value, { stream: true })
    const blocks = buffer.split('\n\n')
    buffer = blocks.pop() ?? ''
    for (const block of blocks) {
      const data = block.match(/^data: (.+)$/m)
      if (data) onJob(JSON.parse(data[1]) as JobView)
    }
  }
}

/**
 * Follows a job's persisted state. It listens to the event stream and, if the
 * stream fails or ends early, falls back to polling the job. Either way the
 * job keeps running on the server when this component goes away.
 */
export function useJob(apiUrl: string, jobId: string) {
  const [job, setJob] = useState<JobView | null>(null)
  const [unreachable, setUnreachable] = useState(false)

  useEffect(() => {
    const abort = new AbortController()
    let latest: JobView | null = null

    const receive = (next: JobView) => {
      // Stream and poll can overlap. The higher version is the newer state.
      if (latest && next.version < latest.version) return
      latest = next
      setJob(next)
      setUnreachable(false)
    }

    const request = async (path: string, headers: Record<string, string> = {}) =>
      fetch(`${apiUrl}${path}`, {
        signal: abort.signal,
        headers: { Authorization: `Bearer ${await accessToken()}`, ...headers },
      })

    async function follow() {
      try {
        const stream = await request(`/v1/jobs/${jobId}/events`, { Accept: 'text/event-stream' })
        if (stream.ok && stream.body) await readJobEvents(stream.body, receive)
      } catch {
        // Fall through to polling.
      }

      while (!abort.signal.aborted && !(latest && isSettled(latest.status))) {
        try {
          const response = await request(`/v1/jobs/${jobId}`)
          if (response.ok) receive((await response.json()) as JobView)
          else setUnreachable(true)
        } catch {
          if (!abort.signal.aborted) setUnreachable(true)
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_MS))
      }
    }

    void follow()
    return () => abort.abort()
  }, [apiUrl, jobId])

  return { job, unreachable }
}
