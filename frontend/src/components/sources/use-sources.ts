'use client'

import { useCallback, useEffect, useState } from 'react'
import type { SourceView } from '@tracck/shared'
import { api } from '@/lib/api/client'

const POLL_MS = 3_000

/**
 * The person's sources, kept fresh while any of them is still being read.
 * `reload` re-reads them now, for after the person adds or removes one.
 */
export function useSources(initial: SourceView[]) {
  const [sources, setSources] = useState(initial)

  const reload = useCallback(async () => {
    try {
      setSources(await api.sources.list())
    } catch {
      // Keep what is on screen; the next poll tries again.
    }
  }, [])

  const collecting = sources.some((source) => source.state === 'collecting')
  useEffect(() => {
    if (!collecting) return
    const timer = window.setInterval(reload, POLL_MS)
    return () => window.clearInterval(timer)
  }, [collecting, reload])

  return { sources, setSources, reload }
}
