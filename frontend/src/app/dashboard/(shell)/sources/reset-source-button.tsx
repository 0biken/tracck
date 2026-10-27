'use client'

import { useState } from 'react'
import type { SourceView } from '@tracck/shared'
import { ErrorNotice } from '@/components/sources/dialogs'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { api } from '@/lib/api/client'

/** Deletes everything a source imported and keeps the connection. Asks first. */
export function ResetSourceButton({ source, onReset }: { source: SourceView; onReset: () => void }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      await api.sources.reset(source.id)
      setOpen(false)
      onReset()
    } catch (failure) {
      setError(failure)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        Reset
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Reset ${source.name}?`}>
        <div className="flex flex-col gap-4 pr-8">
          <h2 className="t-claim m-0">Reset {source.name}?</h2>
          <p className="m-0 text-[15px] leading-[22px] text-ink-muted">
            This deletes everything {source.name} gave Tracck, including entries you pinned or edited, and any file you
            uploaded. The source stays connected.
          </p>
          {error !== null && <ErrorNotice error={error} />}
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" loading={busy} onClick={confirm}>
              Reset source
            </Button>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Keep it
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  )
}
