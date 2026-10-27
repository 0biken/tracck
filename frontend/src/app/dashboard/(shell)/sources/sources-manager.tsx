'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { SourceProvider, SourceView } from '@tracck/shared'
import { ManualEntryDialog } from '@/components/evidence/manual-entry-dialog'
import { ErrorNotice } from '@/components/sources/dialogs'
import { useSourceDialogs, type AddKind } from '@/components/sources/use-source-dialogs'
import { useSources } from '@/components/sources/use-sources'
import { Button } from '@/components/ui/button'
import { Meter } from '@/components/ui/meter'
import { api, messageOf } from '@/lib/api/client'
import { formatCount, formatStamp } from '@/lib/format'
import { ResetSourceButton } from './reset-source-button'

const rowGrid = 'grid grid-cols-1 items-center gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] md:gap-5'

/** What each kind of source can be added with. */
const ADD: { provider: SourceProvider | 'manual'; name: string; body: string; action: string; kind?: AddKind }[] = [
  { provider: 'github', name: 'GitHub', body: 'Public repositories and releases. Your richest source.', action: 'Connect GitHub', kind: 'github' },
  { provider: 'cv', name: 'CV or resume', body: 'PDF or Word. Added to your record, with feedback for your role.', action: 'Upload CV', kind: 'cv' },
  { provider: 'linkedin', name: 'LinkedIn', body: 'Your data export ZIP or profile PDF.', action: 'Upload export', kind: 'linkedin-file' },
  { provider: 'portfolio', name: 'Portfolio', body: 'Any public page you want included.', action: 'Add link', kind: 'portfolio' },
  { provider: 'x', name: 'X', body: "Your posts from X's data archive. Only posts are read.", action: 'Upload archive', kind: 'x-archive' },
  { provider: 'behance', name: 'Behance', body: 'Paste your project titles, descriptions and links.', action: 'Paste projects', kind: 'behance' },
  { provider: 'manual', name: 'Manual entry', body: 'For work with no public trace. You write it; Tracck keeps it as yours.', action: 'Add manually' },
]

type Notice = { tone: 'ok' | 'error'; text: string }

/** Connected sources, with a confirm step before anything is removed. */
export function SourcesManager({ initial, notice: initialNotice }: { initial: SourceView[]; notice: Notice | null }) {
  const router = useRouter()
  const { sources, reload } = useSources(initial)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [keep, setKeep] = useState<'keep' | 'delete'>('keep')
  const [notice, setNotice] = useState<Notice | null>(initialNotice)
  const [busy, setBusy] = useState<string | null>(null)
  const [manualOpen, setManualOpen] = useState(false)

  const afterChange = () => {
    void reload()
    router.refresh()
  }
  const { start, dialogs, connectError } = useSourceDialogs({ from: 'sources', onChanged: afterChange })

  async function act(id: string, action: () => Promise<unknown>, success?: string) {
    setBusy(id)
    try {
      await action()
      if (success) setNotice({ tone: 'ok', text: success })
      afterChange()
    } catch (error) {
      setNotice({ tone: 'error', text: messageOf(error) })
    } finally {
      setBusy(null)
    }
  }

  async function remove(source: SourceView) {
    setConfirming(null)
    setKeep('keep')
    await act(
      source.id,
      () => api.sources.remove(source.id, keep),
      keep === 'delete'
        ? `${source.name} removed, along with the entries it produced.`
        : `${source.name} removed. Its entries stay in your record.`,
    )
  }

  const connected = new Set(sources.map((source) => source.provider))
  // A source can be added again if there is none yet, or it can hold several (links, pasted text).
  const available = ADD.filter((item) => item.provider === 'manual' || !connected.has(item.provider as SourceProvider) || ['portfolio', 'x', 'behance'].includes(item.provider))

  return (
    <>
      {notice && (
        <div
          role={notice.tone === 'error' ? 'alert' : 'status'}
          className={`border px-4 py-3 text-sm ${notice.tone === 'error' ? 'border-danger bg-danger-tint text-danger-ink' : 'border-line-strong bg-sunken'}`}
        >
          {notice.text}
        </div>
      )}
      {connectError !== null && <ErrorNotice error={connectError} />}

      <section aria-label="Connected sources">
        <div
          className={`${rowGrid} hidden border-b-2 border-ink pb-2.5 text-xs font-bold tracking-[0.08em] md:grid`}
          aria-hidden="true"
        >
          <span>SOURCE</span>
          <span>STATUS</span>
          <span />
        </div>

        {sources.map((source) => {
          const problem = source.state === 'problem'
          const isConfirming = confirming === source.id
          const working = busy === source.id
          const fileBased = source.provider === 'cv' || source.provider === 'linkedin'
          return (
            <div key={source.id}>
              <div className={`${rowGrid} border-b py-5 ${problem ? 'border-danger bg-danger-tint px-4' : 'border-line'}`}>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-[17px] font-bold">{source.name}</span>
                  {source.detail && <span className="break-words font-mono text-xs text-ink-muted">{source.detail}</span>}
                </div>

                <div className="flex flex-col gap-1.5">
                  <span
                    className={`font-mono text-[13px] uppercase ${source.state === 'ready' ? 'text-signal' : problem ? 'text-danger-ink' : ''}`}
                  >
                    {source.state === 'ready' && `Ready · ${formatCount(source.entries)} ${source.entries === 1 ? 'entry' : 'entries'}`}
                    {source.state === 'collecting' && 'Collecting'}
                    {problem && 'Problem'}
                  </span>
                  {source.progress && (
                    <Meter value={source.progress.done} label={`${source.name} progress`} className="max-w-56" />
                  )}
                  {source.state === 'ready' && source.lastCollectedAt && (
                    <span className="text-[13px] text-ink-muted">Last collected {formatStamp(source.lastCollectedAt)}</span>
                  )}
                  {source.provider === 'cv' && source.state === 'ready' && (
                    <Link href="/dashboard/feedback" className="text-[13px]">
                      See CV feedback
                    </Link>
                  )}
                  {problem && source.problem && <span className="text-[13px] leading-[19px]">{source.problem}</span>}
                </div>

                <div className="flex flex-wrap gap-2 md:justify-end">
                  {problem && (
                    <Button size="sm" loading={working} onClick={() => act(source.id, () => api.sources.retry(source.id))}>
                      Retry
                    </Button>
                  )}
                  {!problem && !fileBased && source.state === 'ready' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={working}
                      onClick={() => act(source.id, () => api.sources.refresh(source.id))}
                    >
                      Refresh
                    </Button>
                  )}
                  {source.state !== 'collecting' && <ResetSourceButton source={source} onReset={afterChange} />}
                  {fileBased && (
                    <Button size="sm" variant="secondary" onClick={() => start(source.provider === 'cv' ? 'cv' : 'linkedin-file')}>
                      Replace file
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-expanded={isConfirming}
                    onClick={() => setConfirming(isConfirming ? null : source.id)}
                  >
                    {source.state === 'collecting' ? 'Cancel' : source.provider === 'github' ? 'Disconnect' : 'Remove'}
                  </Button>
                </div>
              </div>

              {isConfirming && (
                <div
                  role="group"
                  aria-labelledby={`confirm-${source.id}`}
                  className="my-4 flex flex-col gap-4 border-2 border-ink bg-sunken p-6"
                >
                  <h2 id={`confirm-${source.id}`} className="t-claim m-0">
                    {source.provider === 'github' ? 'Disconnect GitHub?' : `Remove ${source.name}?`}
                  </h2>
                  <p className="m-0 text-[15px] leading-[22px]">
                    {source.provider === 'github'
                      ? `Tracck stops collecting from GitHub. Choose what happens to the ${formatCount(source.entries)} entries it already learned.`
                      : `Tracck stops using ${source.name}. Choose what happens to the ${formatCount(source.entries)} entries it already learned.`}
                  </p>
                  <label className="flex cursor-pointer items-start gap-3 text-[15px] leading-[22px]">
                    <input
                      type="radio"
                      name={`keep-${source.id}`}
                      checked={keep === 'keep'}
                      onChange={() => setKeep('keep')}
                      className="mt-0.5 size-[18px] accent-ink"
                    />
                    <span>
                      <strong>Keep the entries</strong>
                      <br />
                      <span className="text-ink-muted">They stay in your record and can still be used in resumes.</span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-3 text-[15px] leading-[22px]">
                    <input
                      type="radio"
                      name={`keep-${source.id}`}
                      checked={keep === 'delete'}
                      onChange={() => setKeep('delete')}
                      className="mt-0.5 size-[18px] accent-ink"
                    />
                    <span>
                      <strong>Delete everything from {source.name}</strong>
                      <br />
                      <span className="text-ink-muted">
                        Removes its entries, except ones you pinned or reworded. Existing resumes keep their text but lose
                        the evidence link.
                      </span>
                    </span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="danger-solid" loading={working} onClick={() => remove(source)}>
                      {source.provider === 'github' ? 'Disconnect' : 'Remove'}
                    </Button>
                    <Button variant="secondary" onClick={() => setConfirming(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {sources.length === 0 && (
          <p className="m-0 border border-line p-6 text-center text-[15px] text-ink-muted">
            No sources connected. Add one below to start your record.
          </p>
        )}
      </section>

      <section aria-label="Add a source" className="flex flex-col gap-4">
        <h2 className="t-claim m-0">Add a source</h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-3">
          {available.map((item) => (
            <div key={item.provider} className="flex flex-col gap-2 border border-line p-5">
              <span className="font-bold">{item.name}</span>
              <span className="text-sm leading-5 text-ink-muted">{item.body}</span>
              <Button
                variant="secondary"
                className="self-start"
                onClick={() => (item.kind ? start(item.kind) : setManualOpen(true))}
              >
                {item.action}
              </Button>
              {item.provider === 'linkedin' && (
                <Button size="sm" variant="ghost" className="self-start" onClick={() => start('linkedin-paste')}>
                  Or paste your profile
                </Button>
              )}
            </div>
          ))}
        </div>
        <p className="m-0 text-[13px] leading-[19px] text-ink-muted">
          Tracck never scrapes platforms, uses third-party data providers or reads your logged-in sessions. Free plan: 1
          source. <Link href="/dashboard/settings">Pro allows all.</Link>
        </p>
      </section>

      {dialogs}
      <ManualEntryDialog open={manualOpen} onClose={() => setManualOpen(false)} onAdded={afterChange} />
    </>
  )
}
