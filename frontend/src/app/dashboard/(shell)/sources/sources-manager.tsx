'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Meter } from '@/components/ui/meter'
import { ADD_SOURCES, SOURCES, type SourceRow } from '@/lib/mock/record'

const rowGrid = 'grid grid-cols-1 items-center gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] md:gap-5'

/** Connected sources, with a confirm step before anything is removed. */
export function SourcesManager() {
  const [sources, setSources] = useState<SourceRow[]>(SOURCES)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [keep, setKeep] = useState<'keep' | 'delete'>('keep')
  const [notice, setNotice] = useState<string | null>(null)

  function remove(id: string, name: string, deleted: boolean) {
    setSources((list) => list.filter((source) => source.id !== id))
    setConfirming(null)
    setKeep('keep')
    setNotice(
      deleted
        ? `${name} removed, along with the entries it produced.`
        : `${name} disconnected. Its entries stay in your record.`,
    )
  }

  function retry(id: string) {
    setSources((list) =>
      list.map((source) =>
        source.id === id ? { ...source, status: 'collecting', statusLabel: 'COLLECTING', sub: undefined, progress: 0 } : source,
      ),
    )
  }

  return (
    <>
      {notice && (
        <div role="status" className="border border-line-strong bg-sunken px-4 py-3 text-sm">
          {notice}
        </div>
      )}

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
          const problem = source.status === 'problem'
          const isConfirming = confirming === source.id
          return (
            <div key={source.id}>
              <div
                className={`${rowGrid} border-b py-5 ${problem ? 'border-danger bg-danger-tint px-4' : 'border-line'}`}
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-[17px] font-bold">{source.name}</span>
                  <span className="break-words font-mono text-xs text-ink-muted">{source.detail}</span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span
                    className={`font-mono text-[13px] ${
                      source.status === 'ready' ? 'text-signal' : problem ? 'text-danger-ink' : ''
                    }`}
                  >
                    {source.statusLabel}
                  </span>
                  {source.progress !== undefined && (
                    <Meter value={source.progress} label={`${source.name} progress`} className="max-w-56" />
                  )}
                  {source.sub &&
                    (source.id === 'cv' ? (
                      <Link href="/dashboard/feedback" className="text-[13px]">
                        {source.sub}
                      </Link>
                    ) : (
                      <span className={`text-[13px] ${problem ? 'leading-[19px]' : 'text-ink-muted'}`}>{source.sub}</span>
                    ))}
                </div>

                <div className="flex flex-wrap gap-2 md:justify-end">
                  {source.actions.map((action) => (
                    <Button
                      key={action.label}
                      size="sm"
                      variant={action.primary ? 'primary' : 'secondary'}
                      aria-expanded={action.danger || action.label === 'Delete' ? isConfirming : undefined}
                      onClick={() => {
                        if (action.danger || action.label === 'Delete') setConfirming(isConfirming ? null : source.id)
                        else if (action.label === 'Retry') retry(source.id)
                      }}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              </div>

              {isConfirming && (
                <div
                  role="group"
                  aria-labelledby={`confirm-${source.id}`}
                  className="my-4 flex flex-col gap-4 border-2 border-ink bg-sunken p-6"
                >
                  {source.id === 'github' ? (
                    <>
                      <h2 id={`confirm-${source.id}`} className="t-claim m-0">
                        Disconnect GitHub?
                      </h2>
                      <p className="m-0 text-[15px] leading-[22px]">
                        Tracck stops collecting from GitHub. Choose what happens to the 96 entries it already learned.
                      </p>
                      <label className="flex cursor-pointer items-start gap-3 text-[15px] leading-[22px]">
                        <input
                          type="radio"
                          name="keep"
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
                          name="keep"
                          checked={keep === 'delete'}
                          onChange={() => setKeep('delete')}
                          className="mt-0.5 size-[18px] accent-ink"
                        />
                        <span>
                          <strong>Delete everything from GitHub</strong>
                          <br />
                          <span className="text-ink-muted">
                            Removes 96 entries. Existing resumes keep their text but lose the evidence link.
                          </span>
                        </span>
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="danger-solid" onClick={() => remove(source.id, source.name, keep === 'delete')}>
                          Disconnect
                        </Button>
                        <Button variant="secondary" onClick={() => setConfirming(null)}>
                          Cancel
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <h2 id={`confirm-${source.id}`} className="t-claim m-0">
                        Delete {source.name}?
                      </h2>
                      <p className="m-0 text-[15px] leading-[22px]">
                        The file is deleted from Tracck. Entries it produced stay in your record until you delete them
                        in the evidence library.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="danger-solid" onClick={() => remove(source.id, source.name, false)}>
                          Delete
                        </Button>
                        <Button variant="secondary" onClick={() => setConfirming(null)}>
                          Cancel
                        </Button>
                      </div>
                    </>
                  )}
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
          {ADD_SOURCES.map((item) => (
            <div key={item.name} className="flex flex-col gap-2 border border-line p-5">
              <span className="font-bold">{item.name}</span>
              <span className="text-sm leading-5 text-ink-muted">{item.body}</span>
              {'action' in item && item.action ? (
                <Button variant="secondary" className="self-start">
                  {item.action}
                </Button>
              ) : (
                <span className="font-mono text-xs text-ink-muted">SOON</span>
              )}
            </div>
          ))}
        </div>
        <p className="m-0 text-[13px] leading-[19px] text-ink-muted">
          Tracck never scrapes platforms, uses third-party data providers or reads your logged-in sessions. Free plan: 1
          source. <Link href="/dashboard/settings">Pro allows all.</Link>
        </p>
      </section>
    </>
  )
}
