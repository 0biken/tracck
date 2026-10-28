'use client'

import { Check } from 'lucide-react'
import { useRef, useState } from 'react'
import type { EvidencePage, EvidenceShow, EvidenceView, SourceProvider } from '@tracck/shared'
import { Markdown } from '@/components/markdown'
import { ErrorNotice } from '@/components/sources/dialogs'
import { Tag } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { api } from '@/lib/api/client'
import { ApiClientError } from '@/lib/api/errors'
import { formatDate } from '@/lib/format'

interface Filters {
  show: EvidenceShow
  source: SourceProvider | null
  query: string
}

const SHOW_OPTIONS: { value: EvidenceShow; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pinned', label: 'Pinned' },
  { value: 'excluded', label: 'Excluded' },
  { value: 'duplicates', label: 'Possible duplicates' },
  { value: 'edited', label: 'Edited by you' },
]

const SOURCE_OPTIONS: { value: SourceProvider; label: string }[] = [
  { value: 'github', label: 'GitHub' },
  { value: 'cv', label: 'CV' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'manual', label: 'Manual' },
]

const metaOf = (entry: EvidenceView) => [formatDate(entry.date), entry.where].filter(Boolean).join(' · ')

/** Correct your record: pin, exclude, reword and merge. Every change is saved as you make it. */
export function EvidenceLibrary({ initial }: { initial: EvidencePage }) {
  const [page, setPage] = useState(initial)
  const [items, setItems] = useState(initial.items)
  const [filters, setFilters] = useState<Filters>({ show: 'all', source: null, query: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [viewing, setViewing] = useState<EvidenceView | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)

  /** Reads the list again with the given filters. Called from handlers, so a slow reply never overwrites a newer one. */
  const latest = useRef(0)
  async function load(next: Filters) {
    const ticket = ++latest.current
    setLoading(true)
    try {
      const result = await api.evidence.list({
        show: next.show,
        ...(next.source && { source: next.source }),
        ...(next.query.trim() && { q: next.query.trim() }),
      })
      if (ticket !== latest.current) return
      setPage(result)
      setItems(result.items)
      setError(null)
    } catch (failure) {
      if (ticket === latest.current) setError(failure)
    } finally {
      if (ticket === latest.current) setLoading(false)
    }
  }

  function change(next: Filters, delay = 0) {
    setFilters(next)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void load(next), delay)
  }

  async function more() {
    if (!page.nextCursor) return
    setLoading(true)
    try {
      const result = await api.evidence.list({
        show: filters.show,
        cursor: page.nextCursor,
        ...(filters.source && { source: filters.source }),
        ...(filters.query.trim() && { q: filters.query.trim() }),
      })
      setPage({ ...result, items: [...items, ...result.items] })
      setItems((list) => [...list, ...result.items])
    } catch (failure) {
      setError(failure)
    } finally {
      setLoading(false)
    }
  }

  /** Saves one change. A stale version means it changed elsewhere, so the list is read again. */
  async function save(entry: EvidenceView, change: { pinned?: boolean; excluded?: boolean; body?: string }) {
    setBusy(entry.id)
    setNotice(null)
    try {
      await api.evidence.update(entry.id, { ...change, version: entry.version })
      await load(filters)
    } catch (failure) {
      if (failure instanceof ApiClientError && failure.code === 'VERSION_CONFLICT') {
        setNotice(failure.message)
        await load(filters)
      } else {
        setError(failure)
      }
    } finally {
      setBusy(null)
    }
  }

  async function resolve(id: string, action: 'merge' | 'keep_both') {
    setBusy(id)
    try {
      await api.evidence.resolveDuplicate(id, { action })
      setNotice(action === 'merge' ? 'Merged into one entry. Skills and sources of both are kept.' : 'Kept both entries.')
      await load(filters)
    } catch (failure) {
      setError(failure)
    } finally {
      setBusy(null)
    }
  }

  const counts: Record<EvidenceShow, number> = {
    all: page.counts.all,
    pinned: page.counts.pinned,
    excluded: page.counts.excluded,
    duplicates: page.counts.duplicates,
    edited: page.counts.edited,
  }

  const showDuplicates = (filters.show === 'all' || filters.show === 'duplicates') && page.duplicates.length > 0 && !filters.source && !filters.query.trim()

  const filterButton = (active: boolean) =>
    `flex min-h-10 w-full cursor-pointer items-center justify-between gap-3 border px-2.5 text-left text-sm font-semibold ${
      active ? 'border-line-strong bg-sunken text-ink' : 'border-transparent bg-transparent text-ink-muted hover:bg-sunken hover:text-ink'
    }`

  return (
    <div className="flex flex-wrap items-start gap-8">
      <aside aria-label="Filters" className="flex w-full flex-col gap-5 lg:max-w-60 lg:flex-1 lg:basis-50">
        <div>
          <label htmlFor="search" className="sr-only">
            Search evidence
          </label>
          <input
            id="search"
            type="search"
            value={filters.query}
            onChange={(event) => change({ ...filters, query: event.target.value }, 300)}
            placeholder="Search entries"
            className="min-h-11 w-full rounded-sm border border-line-input bg-canvas px-3 text-[15px] placeholder:text-ink-muted/80 hover:border-ink"
          />
        </div>

        <div className="flex flex-col">
          <div className="t-eyebrow px-2.5 pb-1.5 text-ink-muted">Show</div>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1">
            {SHOW_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={filters.show === option.value}
                onClick={() => change({ ...filters, show: option.value })}
                className={filterButton(filters.show === option.value)}
              >
                <span>{option.label}</span>
                <span className="font-mono text-xs">{counts[option.value]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col">
          <div className="t-eyebrow px-2.5 pb-1.5 text-ink-muted">Source</div>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-1">
            {SOURCE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={filters.source === option.value}
                onClick={() => change({ ...filters, source: filters.source === option.value ? null : option.value })}
                className={filterButton(filters.source === option.value)}
              >
                <span>{option.label}</span>
                <span className="font-mono text-xs">{page.counts.bySource[option.value]}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <section aria-label="Entries" aria-busy={loading} className="flex min-w-0 flex-[999_1_480px] flex-col gap-3">
        {error !== null && <ErrorNotice error={error} />}
        {notice && (
          <div role="status" className="flex items-center gap-2.5 border border-signal bg-signal-tint px-4 py-3 text-sm">
            <Check className="size-4 shrink-0 text-signal" strokeWidth={2.5} aria-hidden="true" />
            {notice}
          </div>
        )}

        {showDuplicates &&
          page.duplicates.map((pair) => (
            <div key={pair.id} className="flex flex-col gap-3 border border-line-strong bg-sunken p-5">
              <div className="flex flex-wrap justify-between gap-3">
                <span className="font-bold">Possible duplicate</span>
                <span className="font-mono text-xs text-ink-muted">2 ENTRIES · {pair.a.source} AND {pair.b.source}</span>
              </div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-3">
                {[pair.a, pair.b].map((item) => (
                  <div key={item.id} className="border border-line bg-canvas p-3.5 text-sm leading-5">
                    <div className="mb-1.5 font-mono text-[11px] text-ink-muted">
                      {item.source}
                      {item.date && ` · ${formatDate(item.date)}`}
                    </div>
                    <Markdown>{item.text}</Markdown>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" loading={busy === pair.id} onClick={() => resolve(pair.id, 'merge')}>
                  Merge into one entry
                </Button>
                <Button size="sm" variant="secondary" disabled={busy === pair.id} onClick={() => resolve(pair.id, 'keep_both')}>
                  Keep both
                </Button>
              </div>
            </div>
          ))}

        {items.length === 0 && !loading && (
          <p className="m-0 border border-line p-6 text-center text-[15px] text-ink-muted">
            {filters.show === 'duplicates' ? 'No possible duplicates right now.' : counts.all === 0 && !filters.query ? 'Nothing here yet. Connect a source or add an entry.' : 'No entries match.'}
          </p>
        )}

        {items.map((entry) => (
          <article
            key={entry.id}
            className={`flex flex-col gap-2.5 border p-5 ${
              entry.pinned ? 'border-ink bg-canvas' : entry.excluded ? 'border-line bg-sunken' : 'border-line bg-canvas'
            }`}
          >
            <div className="flex flex-wrap justify-between gap-3">
              <span className="font-mono text-xs text-ink-muted">
                ENTRY {entry.number} · {entry.source}
                {metaOf(entry) && ` · ${metaOf(entry)}`}
                {entry.edited && ' · EDITED BY YOU'}
              </span>
              {entry.pinned && <Tag tone="ink">PINNED</Tag>}
              {entry.excluded && <Tag tone="danger">EXCLUDED</Tag>}
              {!entry.pinned && !entry.excluded && entry.usedInResumes > 0 ? (
                <span className="font-mono text-xs text-ink-muted">
                  USED IN {entry.usedInResumes} {entry.usedInResumes === 1 ? 'RESUME' : 'RESUMES'}
                </span>
              ) : null}
            </div>
            <h2 className={`t-claim m-0 ${entry.excluded ? 'text-ink-muted' : ''}`}>{entry.title}</h2>

            {editing === entry.id ? (
              <EditWording
                initial={entry.body}
                saving={busy === entry.id}
                onSave={async (body) => {
                  await save(entry, { body })
                  setEditing(null)
                }}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <p className="m-0 text-[15px] leading-[22px] text-ink-muted">{entry.body}</p>
            )}

            {entry.skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {entry.skills.map((skill) => (
                  <Tag key={skill}>{skill}</Tag>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2 border-t border-line pt-3">
              {entry.excluded ? (
                <Button size="sm" variant="secondary" loading={busy === entry.id} onClick={() => save(entry, { excluded: false })}>
                  Include again
                </Button>
              ) : (
                <>
                  <Button size="sm" variant="secondary" disabled={busy === entry.id} onClick={() => save(entry, { pinned: !entry.pinned })} aria-pressed={entry.pinned}>
                    {entry.pinned ? 'Unpin' : 'Pin'}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setEditing(entry.id)}>
                    Edit wording
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setViewing(entry)}>
                    View original
                  </Button>
                  <Button size="sm" variant="danger" disabled={busy === entry.id} onClick={() => save(entry, { excluded: true, pinned: false })}>
                    Exclude
                  </Button>
                </>
              )}
            </div>
          </article>
        ))}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="m-0 font-mono text-xs text-ink-muted">
            Showing {items.length} of {counts[filters.show]} entries.
          </p>
          {page.nextCursor && (
            <Button variant="secondary" size="sm" loading={loading} onClick={more}>
              Show more
            </Button>
          )}
        </div>
      </section>

      <Dialog open={viewing !== null} onClose={() => setViewing(null)} title="Original text">
        {viewing && (
          <div className="flex flex-col gap-4 pr-8">
            <div className="t-eyebrow text-ink-muted">
              Entry {viewing.number} · {viewing.source}
              {metaOf(viewing) && ` · ${metaOf(viewing)}`}
            </div>
            <h2 className="t-claim m-0">{viewing.title}</h2>
            <div className="border border-line bg-sunken p-4 text-[13px] leading-5">
              <Markdown>{viewing.original}</Markdown>
            </div>
            <p className="m-0 text-sm leading-5 text-ink-muted">
              This is the text Tracck read. Editing the wording changes how the entry reads in resumes, not this original.
            </p>
            <div>
              <Button variant="secondary" onClick={() => setViewing(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}

function EditWording({
  initial,
  saving,
  onSave,
  onCancel,
}: {
  initial: string
  saving: boolean
  onSave: (text: string) => void
  onCancel: () => void
}) {
  const [text, setText] = useState(initial)
  const valid = text.trim().length >= 20
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="wording" className="sr-only">
        Entry wording
      </label>
      <textarea
        id="wording"
        autoFocus
        rows={3}
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="w-full resize-y rounded-sm border border-line-input bg-canvas p-3 text-[15px] leading-[22px] hover:border-ink"
      />
      {!valid && <p className="m-0 text-[13px] text-ink-muted">Write at least a sentence.</p>}
      <div className="flex gap-2">
        <Button size="sm" disabled={!valid} loading={saving} onClick={() => onSave(text.trim())}>
          Save wording
        </Button>
        <Button size="sm" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

