'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'

/** Reads the graph again, for after sources finished collecting. */
export function RefreshButton() {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <Button variant="secondary" loading={pending} onClick={() => start(() => router.refresh())}>
      Refresh now
    </Button>
  )
}
