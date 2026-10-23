'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ManualEntryDialog } from '@/components/evidence/manual-entry-dialog'
import { Button } from '@/components/ui/button'

/** Opens the manual entry dialog, then refreshes the page so the new entry shows. */
export function AddEntryButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Add an entry</Button>
      <ManualEntryDialog
        open={open}
        onClose={() => setOpen(false)}
        onAdded={() => {
          setOpen(false)
          router.refresh()
        }}
      />
    </>
  )
}
