'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ErrorNotice } from '@/components/sources/dialogs'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { api } from '@/lib/api/client'

/** Deleting every resume is permanent, so it asks first. The person's record is not touched. */
export function DeleteAllResumes({ count }: { count: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      await api.resumes.removeAll()
      setOpen(false)
      router.refresh()
    } catch (failure) {
      setError(failure)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        Delete all resumes
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Delete all resumes">
        <div className="flex flex-col gap-4 pr-8">
          <h2 className="t-h3 m-0">Delete all {count} resumes?</h2>
          <p className="m-0 text-[15px] leading-[22px] text-ink-muted">
            Every resume, its versions, exported files and saved job text will be removed. Your evidence and sources stay as
            they are. This cannot be undone.
          </p>
          {error !== null && <ErrorNotice error={error} />}
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" loading={busy} onClick={confirm}>
              Delete everything
            </Button>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Keep them
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  )
}
