'use client'

import { Check } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Tag } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { ACCOUNT } from '@/lib/mock/account'
import { DUPLICATE_PAIR, ENTRIES, type EntrySource, type EvidenceEntry } from '@/lib/mock/record'

type Show = 'all' | 'pinned' | 'excluded' | 'duplicates' | 'edited'
type Duplicate = 'open' | 'merged' | 'kept'

const initial = {
  pinned: ENTRIES.filter((entry) => entry.pinned).length,
  excluded: ENTRIES.filter((entry) => entry.excluded).length,
  edited: ENTRIES.filter((entry) => entry.edited).length,
}

/** Correct your record: pin, exclude, reword and merge. Changes live in this session only. */
export function EvidenceLibrary() {
  const [entries, setEntries] = useState<EvidenceEntry[]>(ENTRIES)
  const [duplicate, setDuplicate] = useState<Duplicate>('open')
  const [show, setShow] = useState<Show>('all')
  const [source, setSource] = useState<EntrySource | 'all'>('all')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [viewing, setViewing] = useState<EvidenceEntry | null>(null)

  const pinned = entries.filter((entry) => entry.pinned).length
  const excluded = entries.filter((entry) => entry.excluded).length
  const edited = entries.filter((entry) => entry.edited).length

  // The account totals are the full record; the list below is the page loaded so far.
  const counts: Record<Show, number> = {
    all: ACCOUNT.entries,
    pinned: ACCOUNT.pinned + (pinned - initial.pinned),
    excluded: ACCOUNT.excluded + (excluded - initial.excluded),
    duplicates: duplicate === 'open' ? ACCOUNT.duplicates : ACCOUNT.duplicates - 1,
    edited: ACCOUNT.edited + (edited - initial.edited),
  }

  const shown = useMemo(() => {
    const text = query.trim().toLowerCase()
    return entries.filter((entry) => {
      if (show === 'pinned' && !entry.pinned) return false
      if (show === 'excluded' && !entry.excluded) return false
      if (show === 'edited' && !entry.edited) return false
      if (show === 'duplicates') return false
      if (source !== 'all' && entry.source !== source) return false
      return !text || `${entry.title} ${entry.body} ${entry.skills.join(' ')}`.toLowerCase().includes(text)
    })
  }, [entries, show, source, query])

  const showDuplicate = (show === 'all' || show === 'duplicates') && duplicate === 'open' && source === 'all' && !query.trim()

  function patch(id: string, change: Partial<EvidenceEntry>) {
    setEntries((list) => list.map((entry) => (entry.id === id ? { ...entry, ...change } : entry)))
  }

  const showOptions: { value: Show; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'pinned', label: 'Pinned' },
    { value: 'excluded', label: 'Excluded' },
    { value: 'duplicates', label: 'Possible duplicates' },
    { value: 'edited', label: 'Edited by you' },
  ]
  const sourceOptions: { value: EntrySource; label: string; n: number }[] = [
    { value: 'GITHUB', label: 'GitHub', n: ACCOUNT.bySource.github },
    { value: 'CV', label: 'CV', n: ACCOUNT.bySource.cv },
    { value: 'LINKEDIN', label: 'LinkedIn', n: ACCOUNT.bySource.linkedin },
    { value: 'MANUAL', label: 'Manual', n: ACCOUNT.bySource.manual },
  ]

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
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search entries"
            className="min-h-11 w-full rounded-sm border border-line-input bg-canvas px-3 text-[15px] placeholder:text-ink-muted/80 hover:border-ink"
          />
        </div>

        <div className="flex flex-col">
          <div className="t-eyebrow px-2.5 pb-1.5 text-ink-muted">Show</div>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1">
            {showOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={show === option.value}
                onClick={() => setShow(option.value)}
                className={filterButton(show === option.value)}
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
            {sourceOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={source === option.value}
                onClick={() => setSource(source === option.value ? 'all' : option.value)}
                className={filterButton(source === option.value)}
              >
                <span>{option.label}</span>
                <span className="font-mono text-xs">{option.n}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <section aria-label="Entries" className="flex min-w-0 flex-[999_1_480px] flex-col gap-3">
        {duplicate === 'merged' && (
          <div role="status" className="flex items-center gap-2.5 border border-signal bg-signal-tint px-4 py-3 text-sm">
            <Check className="size-4 shrink-0 text-signal" strokeWidth={2.5} aria-hidden="true" />
            Merged into one entry. The original wording of both is kept in its history.
          </div>
        )}

        {showDuplicate && (
          <div className="flex flex-col gap-3 border border-line-strong bg-sunken p-5">
            <div className="flex flex-wrap justify-between gap-3">
              <span className="font-bold">Possible duplicate</span>
              <span className="font-mono text-xs text-ink-muted">2 ENTRIES · SAME PROJECT</span>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-3">
              {[DUPLICATE_PAIR.a, DUPLICATE_PAIR.b].map((item) => (
                <div key={item.source} className="border border-line bg-canvas p-3.5 text-sm leading-5">
                  <div className="mb-1.5 font-mono text-[11px] text-ink-muted">{item.source}</div>
                  {item.text}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setDuplicate('merged')}>
                Merge into one entry
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setDuplicate('kept')}>
                Keep both
              </Button>
            </div>
          </div>
        )}

        {shown.length === 0 && !showDuplicate && (
          <p className="m-0 border border-line p-6 text-center text-[15px] text-ink-muted">
            {show === 'duplicates' ? 'No possible duplicates right now.' : 'No entries match.'}
          </p>
        )}

        {shown.map((entry) => (
          <article
            key={entry.id}
            className={`flex flex-col gap-2.5 border p-5 ${
              entry.pinned ? 'border-ink bg-canvas' : entry.excluded ? 'border-line bg-sunken' : 'border-line bg-canvas'
            }`}
          >
            <div className="flex flex-wrap justify-between gap-3">
              <span className="font-mono text-xs text-ink-muted">
                ENTRY {entry.number} · {entry.source} · {entry.meta}
                {entry.edited && ' · EDITED BY YOU'}
              </span>
              {entry.pinned && <Tag tone="ink">PINNED</Tag>}
              {entry.excluded && <Tag tone="danger">EXCLUDED</Tag>}
              {!entry.pinned && !entry.excluded && entry.usedIn ? (
                <span className="font-mono text-xs text-ink-muted">
                  USED IN {entry.usedIn} {entry.usedIn === 1 ? 'RESUME' : 'RESUMES'}
                </span>
              ) : null}
            </div>
            <h2 className={`t-claim m-0 ${entry.excluded ? 'text-ink-muted' : ''}`}>{entry.title}</h2>

            {editing === entry.id ? (
              <EditWording
                initial={entry.body}
                onSave={(body) => {
                  patch(entry.id, { body, edited: true })
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
                <Button size="sm" variant="secondary" onClick={() => patch(entry.id, { excluded: false })}>
                  Include again
                </Button>
              ) : (
                <>
                  <Button size="sm" variant="secondary" onClick={() => patch(entry.id, { pinned: !entry.pinned })} aria-pressed={!!entry.pinned}>
                    {entry.pinned ? 'Unpin' : 'Pin'}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setEditing(entry.id)}>
                    Edit wording
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setViewing(entry)}>
                    View original
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => patch(entry.id, { excluded: true, pinned: false })}>
                    Exclude
                  </Button>
                </>
              )}
            </div>
          </article>
        ))}

        <p className="m-0 pt-1 font-mono text-xs text-ink-muted">
          Showing {entries.length} of {ACCOUNT.entries} entries. The rest load as you scroll once this is connected.
        </p>
      </section>

      <Dialog open={viewing !== null} onClose={() => setViewing(null)} title="Original text">
        {viewing && (
          <div className="flex flex-col gap-4 pr-8">
            <div className="t-eyebrow text-ink-muted">
              Entry {viewing.number} · {viewing.source} · {viewing.meta}
            </div>
            <h2 className="t-claim m-0">{viewing.title}</h2>
            <div className="border border-line bg-sunken p-4 font-mono text-[13px] leading-5">{viewing.original}</div>
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
  initial: initialText,
  onSave,
  onCancel,
}: {
  initial: string
  onSave: (text: string) => void
  onCancel: () => void
}) {
  const [text, setText] = useState(initialText)
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
      <div className="flex gap-2">
        <Button size="sm" onClick={() => onSave(text.trim() || initialText)}>
          Save wording
        </Button>
        <Button size="sm" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
