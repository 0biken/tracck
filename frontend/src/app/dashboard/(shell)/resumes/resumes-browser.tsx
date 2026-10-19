'use client'

import { useMemo, useState } from 'react'
import { ResumeRows } from '@/components/resumes/resume-rows'
import { Segmented } from '@/components/ui/segmented'
import type { ResumeSummary } from '@/lib/mock/resumes'

type Filter = 'all' | 'drafts' | 'exported'

/** Search by company or job title, filter by state. */
export function ResumesBrowser({ resumes }: { resumes: ResumeSummary[] }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const shown = useMemo(() => {
    const text = query.trim().toLowerCase()
    return resumes.filter((resume) => {
      if (filter === 'drafts' && resume.status !== 'draft') return false
      if (filter === 'exported' && resume.status !== 'exported') return false
      return !text || `${resume.company} ${resume.title}`.toLowerCase().includes(text)
    })
  }, [resumes, query, filter])

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
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by company or job title"
          className="min-h-11 min-w-0 flex-[1_1_280px] rounded-sm border border-line-input bg-canvas px-3.5 text-[15px] placeholder:text-ink-muted/80 hover:border-ink"
        />
        <Segmented
          label="Filter"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'drafts', label: 'Drafts' },
            { value: 'exported', label: 'Exported' },
          ]}
        />
      </div>

      <div aria-live="polite">
        <ResumeRows items={shown} />
      </div>
    </>
  )
}
