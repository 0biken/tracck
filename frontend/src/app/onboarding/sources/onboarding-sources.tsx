'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { SourceProvider, SourceView } from '@tracck/shared'
import { ManualEntryDialog } from '@/components/evidence/manual-entry-dialog'
import { ErrorNotice } from '@/components/sources/dialogs'
import { useSourceDialogs, type AddKind } from '@/components/sources/use-source-dialogs'
import { useSources } from '@/components/sources/use-sources'
import { Tag } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckField } from '@/components/ui/field'
import { api, messageOf } from '@/lib/api/client'

const rowClass =
  'grid grid-cols-1 items-center gap-4 border-b border-line py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-5 sm:py-[22px]'

interface Row {
  provider: SourceProvider | 'manual'
  name: string
  body: string
  /** Buttons when nothing is connected, then when something is. */
  add: { label: string; kind: AddKind }[]
  replace?: { label: string; kind: AddKind }
  tag?: string
}

const ROWS: Row[] = [
  { provider: 'github', name: 'GitHub', body: 'Public repositories and releases. Collecting starts as soon as you connect.', add: [{ label: 'Connect GitHub', kind: 'github' }], replace: { label: 'Change', kind: 'github' } },
  { provider: 'cv', name: 'CV or resume', body: 'PDF or Word. We will also give you feedback on it.', add: [{ label: 'Upload CV', kind: 'cv' }], replace: { label: 'Replace', kind: 'cv' } },
  {
    provider: 'linkedin',
    name: 'LinkedIn',
    body: 'Upload your data export ZIP (Settings › Data privacy › Get a copy of your data), a profile PDF, or paste your profile text.',
    add: [
      { label: 'Upload ZIP or PDF', kind: 'linkedin-file' },
      { label: 'Paste', kind: 'linkedin-paste' },
    ],
    replace: { label: 'Replace', kind: 'linkedin-file' },
  },
  { provider: 'portfolio', name: 'Portfolio or personal site', body: 'A public page Tracck can read.', add: [{ label: 'Add link', kind: 'portfolio' }] },
  { provider: 'x', name: 'X', body: "Your posts from X's data archive. Only posts are read.", add: [{ label: 'Upload archive', kind: 'x-archive' }] },
]

/** The sources step of setup: connect what you have, then agree and continue. */
export function OnboardingSources({
  initial,
  notice,
}: {
  initial: SourceView[]
  notice: { tone: 'ok' | 'error'; text: string } | null
}) {
  const router = useRouter()
  const { sources, reload } = useSources(initial)
  const [agreed, setAgreed] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [continuing, setContinuing] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const { start, dialogs, connectError } = useSourceDialogs({ from: 'onboarding', onChanged: () => void reload() })

  const byProvider = (provider: string) => sources.find((source) => source.provider === provider)
  const count = sources.length

  async function next() {
    setContinuing(true)
    setError(null)
    try {
      await api.me.acceptPolicy()
      router.push('/onboarding/status')
    } catch (failure) {
      setError(failure)
      setContinuing(false)
    }
  }

  return (
    <div className="min-w-0">
      {notice && (
        <div
          role={notice.tone === 'error' ? 'alert' : 'status'}
          className={`mb-4 border px-4 py-3 text-sm ${notice.tone === 'error' ? 'border-danger bg-danger-tint text-danger-ink' : 'border-signal bg-signal-tint'}`}
        >
          {notice.text}
        </div>
      )}
      {connectError !== null && (
        <div className="mb-4">
          <ErrorNotice error={connectError} />
        </div>
      )}

      {ROWS.map((row, index) => {
        const existing = byProvider(row.provider)
        return (
          <div key={row.provider} className={`${rowClass} ${index === 0 ? 'border-t-2 border-t-ink' : ''}`}>
            <div className="flex flex-col gap-1">
              <span className="flex flex-wrap items-center gap-2.5">
                <span className="text-lg font-bold">{row.name}</span>
                {existing ? (
                  <Tag tone={existing.state === 'problem' ? 'danger' : 'signal'}>
                    {existing.state === 'problem' ? 'PROBLEM' : existing.state === 'collecting' ? 'COLLECTING' : 'CONNECTED'}
                  </Tag>
                ) : (
                  row.tag && <Tag>{row.tag}</Tag>
                )}
              </span>
              <span className="text-sm leading-[21px] text-ink-muted">
                {existing?.detail ? `${existing.detail}. ` : ''}
                {row.body}
              </span>
              {existing?.problem && <span className="text-sm leading-[21px] text-danger-ink">{existing.problem}</span>}
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              {existing && row.replace ? (
                <Button variant="secondary" onClick={() => start(row.replace!.kind)}>
                  {row.replace.label}
                </Button>
              ) : (
                row.add.map((action) => (
                  <Button key={action.kind} variant="secondary" onClick={() => start(action.kind)}>
                    {action.label}
                  </Button>
                ))
              )}
            </div>
          </div>
        )
      })}

      <div className={rowClass}>
        <div className="flex flex-col gap-1">
          <span className="text-lg font-bold">Manual entry</span>
          <span className="text-sm leading-[21px] text-ink-muted">
            Little public presence? Describe your work and Tracck keeps it as yours.
          </span>
        </div>
        <Button variant="secondary" onClick={() => setManualOpen(true)}>
          Add manually
        </Button>
      </div>

      <div className="flex flex-col gap-4 pt-6">
        <CheckField checked={agreed} onChange={(event) => setAgreed(event.target.checked)} className="items-start text-[15px] leading-[22px]">
          <span>
            I agree to the <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>, and that the
            entries relevant to a job are sent to AI providers to write my resume.
          </span>
        </CheckField>

        {error !== null && <ErrorNotice error={error} />}
        {count === 0 && <p className="m-0 text-[13px] text-ink-muted">Add at least one source to continue.</p>}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/onboarding/role" className="inline-flex min-h-11 items-center text-sm font-semibold">
            Back
          </Link>
          <Button size="lg" disabled={count === 0 || !agreed} loading={continuing} onClick={next}>
            Continue with {count} {count === 1 ? 'source' : 'sources'}
          </Button>
        </div>
      </div>

      {dialogs}
      <ManualEntryDialog open={manualOpen} onClose={() => setManualOpen(false)} onAdded={() => void reload()} />
    </div>
  )
}

export { messageOf }
