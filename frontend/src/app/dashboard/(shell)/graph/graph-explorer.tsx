'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { GraphProject } from '@tracck/shared'
import { ColumnHead } from '@/components/page-header'
import { Tag } from '@/components/ui/badge'
import { formatDate } from '@/lib/format'

/** Pick a project on the left, see what Tracck learned about it on the right. */
export function GraphExplorer({ projects, more }: { projects: GraphProject[]; more: number }) {
  const [selectedId, setSelectedId] = useState(projects[0].id)
  const project = projects.find((item) => item.id === selectedId) ?? projects[0]
  const period = [project.period.from, project.period.to]
    .filter(Boolean)
    .map((date) => formatDate(date))
    .join(' to ')

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-10">
      <section aria-label="Projects" className="flex flex-col">
        <ColumnHead>PROJECTS</ColumnHead>
        {projects.map((item) => {
          const current = item.id === project.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedId(item.id)}
              aria-current={current ? 'true' : undefined}
              className={`flex min-h-12 w-full cursor-pointer items-center justify-between gap-2 border-0 border-b border-line p-3 text-left text-[15px] text-ink ${
                current ? 'border-l-2 border-l-ink bg-sunken font-bold' : 'bg-transparent hover:bg-sunken'
              }`}
            >
              <span>{item.name}</span>
              <span className="font-mono text-xs text-ink-muted">{item.count}</span>
            </button>
          )
        })}
        {more > 0 && <div className="p-3 text-[15px] text-ink-muted">+ {more} more</div>}
      </section>

      <section aria-label="Selected project" className="flex min-w-0 flex-col gap-5">
        <div className="flex flex-col gap-3 border border-line-strong bg-sunken p-6">
          <div className="t-eyebrow text-ink-muted">
            Project{period && ` · ${period}`} · {project.sources} {project.sources === 1 ? 'source' : 'sources'}
          </div>
          <h2 className="m-0 font-display text-[28px] font-bold leading-[34px]">{project.name}</h2>
          {project.summary && <p className="m-0 text-base leading-6">{project.summary}</p>}
          <div className="flex flex-wrap gap-1.5">
            {project.skills.map((skill) => (
              <Tag key={skill} tone="muted" className="px-2 py-1">
                {skill}
              </Tag>
            ))}
          </div>
          <div className="font-mono text-xs text-ink-muted">
            Used in {project.usedInResumes} {project.usedInResumes === 1 ? 'resume' : 'resumes'} · Pinned: {project.pinned ? 'yes' : 'no'}
          </div>
        </div>

        <div>
          <ColumnHead>CONNECTED ENTRIES</ColumnHead>
          {project.entries.map((entry) => (
            <div
              key={`${entry.date}-${entry.text}`}
              className="grid gap-1 border-b border-line py-3.5 sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-4"
            >
              <span className="font-mono text-xs text-ink-muted">
                {formatDate(entry.date)}
                <br />
                {entry.source}
              </span>
              <span className="text-[15px] leading-[22px]">{entry.text}</span>
            </div>
          ))}
          {project.more > 0 && (
            <div className="grid gap-1 py-3.5 sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-4">
              <span className="font-mono text-xs text-ink-muted">+ {project.more}</span>
              <Link href="/dashboard/evidence" className="text-sm font-semibold">
                See all in the evidence library
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
