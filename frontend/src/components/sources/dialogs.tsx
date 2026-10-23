'use client'

import Link from 'next/link'
import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { TextAreaField, TextField } from '@/components/ui/field'
import { ApiClientError, messageOf } from '@/lib/api/client'

/** An error from the API, with a way forward when a plan limit is the reason. */
export function ErrorNotice({ error }: { error: unknown }) {
  const limited = error instanceof ApiClientError && error.planLimit
  return (
    <Alert tone="danger" title={limited ? 'Your plan limit is reached' : 'That did not work'}>
      {messageOf(error)}
      {limited && (
        <>
          {' '}
          <Link href="/dashboard/settings" className="font-semibold">
            See plans
          </Link>
        </>
      )}
    </Alert>
  )
}

function DialogFrame({ title, intro, children }: { title: string; intro: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 pr-8">
      <h2 className="t-claim m-0">{title}</h2>
      <p className="m-0 text-[15px] leading-[22px] text-ink-muted">{intro}</p>
      {children}
    </div>
  )
}

/** Runs an action, keeping the dialog open with the error if it fails. */
function useSubmit(onDone: () => void) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      onDone()
    } catch (failure) {
      setError(failure)
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, run, clear: () => setError(null) }
}

export function UploadDialog({
  open,
  onClose,
  title,
  intro,
  accept,
  hint,
  onUpload,
}: {
  open: boolean
  onClose: () => void
  title: string
  intro: ReactNode
  /** Value for the file input's `accept`, for example ".pdf,.docx". */
  accept: string
  hint: string
  onUpload: (file: File) => Promise<void>
}) {
  const [file, setFile] = useState<File | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const { busy, error, run, clear } = useSubmit(() => {
    setFile(null)
    onClose()
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    if (file) void run(() => onUpload(file))
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        setFile(null)
        clear()
        onClose()
      }}
      title={title}
    >
      <DialogFrame title={title} intro={intro}>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <label
            htmlFor="source-file"
            className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-1.5 border border-dashed border-line-input px-4 py-6 text-center hover:bg-sunken"
          >
            <span className="font-semibold">{file ? file.name : 'Choose a file'}</span>
            <span className="text-[13px] text-ink-muted">{file ? `${(file.size / 1024).toFixed(0)} KB` : hint}</span>
          </label>
          <input
            id="source-file"
            ref={input}
            type="file"
            accept={accept}
            className="sr-only"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          {error !== null && <ErrorNotice error={error} />}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={!file} loading={busy}>
              Upload
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogFrame>
    </Dialog>
  )
}

export function PasteDialog({
  open,
  onClose,
  title,
  intro,
  label,
  help,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  title: string
  intro: ReactNode
  label: string
  help: string
  onSubmit: (text: string) => Promise<void>
}) {
  const [text, setText] = useState('')
  const { busy, error, run, clear } = useSubmit(() => {
    setText('')
    onClose()
  })
  const tooShort = text.trim().length < 20

  return (
    <Dialog
      open={open}
      onClose={() => {
        clear()
        onClose()
      }}
      title={title}
      size="lg"
    >
      <DialogFrame title={title} intro={intro}>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (!tooShort) void run(() => onSubmit(text.trim()))
          }}
          className="flex flex-col gap-4"
        >
          <TextAreaField
            id="pasted-text"
            label={label}
            rows={10}
            value={text}
            onChange={(event) => setText(event.target.value)}
            help={help}
            maxLength={90000}
          />
          {error !== null && <ErrorNotice error={error} />}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={tooShort} loading={busy}>
              Add
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogFrame>
    </Dialog>
  )
}

export function LinkDialog({
  open,
  onClose,
  title,
  intro,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  title: string
  intro: ReactNode
  onSubmit: (url: string) => Promise<void>
}) {
  const [url, setUrl] = useState('')
  const { busy, error, run, clear } = useSubmit(() => {
    setUrl('')
    onClose()
  })
  const valid = /^https?:\/\/[^\s/]+\.[^\s/]+/.test(url.trim())

  return (
    <Dialog
      open={open}
      onClose={() => {
        clear()
        onClose()
      }}
      title={title}
    >
      <DialogFrame title={title} intro={intro}>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (valid) void run(() => onSubmit(url.trim()))
          }}
          className="flex flex-col gap-4"
        >
          <TextField
            id="source-link"
            label="Address"
            type="url"
            size="lg"
            placeholder="https://"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            help="A public page. Tracck reads what anyone could see."
          />
          {error !== null && <ErrorNotice error={error} />}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={!valid} loading={busy}>
              Add link
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogFrame>
    </Dialog>
  )
}
