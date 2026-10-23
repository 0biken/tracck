'use client'

import { useRef, useState } from 'react'
import type { Page, ResumeStatus, ResumeSummaryView } from '@tracck/shared'
import { ResumeRows } from '@/components/resumes/resume-rows'
import { ErrorNotice } from '@/components/sources/dialogs'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { api } from '@/lib/api/client'

type Filter = 'all' | 'draft' | 'exported'

/** Search by company or job title, filter by state. Both are answered by the server, so long lists stay fast. */
export function ResumesBrowser({ initial }: { initial: Page<ResumeSummaryView> }) {
  const [page, setPage] = useState(initial)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const timer = useRef<number | undefined>(undefined)
  const latest = useRef(0)

  async function load(text: string, status: Filter, cursor?: string) {
    const ticket = ++latest.current
    setLoading(true)
    try {
      const result = await api.resumes.list({
        ...(text.trim() && { q: text.trim() }),
        ...(status !== 'all' && { status: status as ResumeStatus }),
        ...(cursor && { cursor }),
      })
      if (ticket !== latest.current) return
      setPage(cursor ? { ...result, items: [...page.items, ...result.items] } : result)
      setError(null)
    } catch (failure) {
      if (ticket === latest.current) setError(failure)
    } finally {
      if (ticket === latest.current) setLoading(false)
    }
  }

  function search(text: string) {
    setQuery(text)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void load(text, filter), 300)
  }

  function choose(next: Filter) {
    setFilter(next)
    void load(query, next)
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="q" className="sr-only">
          Search resumes
        </label>
        <input
          id="q"
          type="search"
          value={query}
          onChange={(event) => search(event.target.value)}
          placeholder="Search by company or job title"
          className="min-h-11 min-w-0 flex-[1_1_280px] rounded-sm border border-line-input bg-canvas px-3.5 text-[15px] placeholder:text-ink-muted/80 hover:border-ink"
        />
        <Segmented
          label="Filter"
          value={filter}
          onChange={choose}
          options={[
            { value: 'all', label: 'All' },
            { value: 'draft', label: 'Drafts' },
            { value: 'exported', label: 'Exported' },
          ]}
        />
      </div>

      {error !== null && <ErrorNotice error={error} />}

      <div aria-live="polite" aria-busy={loading}>
        <ResumeRows items={page.items} />
      </div>

      {page.nextCursor && (
        <div>
          <Button variant="secondary" loading={loading} onClick={() => void load(query, filter, page.nextCursor!)}>
            Show more
          </Button>
        </div>
      )}
    </>
  )
}
