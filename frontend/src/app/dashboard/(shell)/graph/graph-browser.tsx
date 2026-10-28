'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { GraphGroup, GraphProject } from '@tracck/shared'
import { ColumnHead } from '@/components/page-header'
import { Tag } from '@/components/ui/badge'
import { Markdown } from '@/components/markdown'
import { formatDate } from '@/lib/format'

type Item = GraphGroup & Partial<Pick<GraphProject, 'skills' | 'usedInResumes'>>

export interface GraphSectionData {
  key: string
  label: string
  items: Item[]
  moreItems?: number
}

const periodOf = (item: Item) => [item.period.from, item.period.to].filter(Boolean).map((date) => formatDate(date)).join(' to ')

/**
 * Pick a section on the left (collapsible), then an item under it, and read its content on the right.
 * Empty sections are never passed in, so the menu only shows what the person has.
 */
export function GraphBrowser({ sections }: { sections: GraphSectionData[] }) {
  const first = sections[0]
  const [selected, setSelected] = useState(first ? `${first.key}:${first.items[0].id}` : '')
  const [open, setOpen] = useState<Record<string, boolean>>({})

  const isOpen = (key: string) => open[key] ?? true
  const toggle = (key: string) => setOpen((state) => ({ ...state, [key]: !isOpen(key) }))

  const current = sections.flatMap((section) => section.items.map((item) => ({ item, id: `${section.key}:${item.id}` }))).find((entry) => entry.id === selected)?.item ?? first?.items[0]

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-10">
      <nav aria-label="Career graph sections" className="flex flex-col gap-5">
        {sections.map((section) => {
          const expanded = isOpen(section.key)
          return (
            <div key={section.key} className="flex flex-col">
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={`graph-${section.key}`}
                onClick={() => toggle(section.key)}
                className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 border-0 border-b border-ink bg-transparent p-0 pb-2 text-left"
              >
                <ColumnHead>{section.label.toUpperCase()}</ColumnHead>
                <span className="flex items-center gap-2 font-mono text-xs text-ink-muted">
                  {section.items.length + (section.moreItems ?? 0)}
                  <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
                </span>
              </button>

              {expanded && (
                <ul id={`graph-${section.key}`} className="m-0 flex list-none flex-col p-0">
                  {section.items.map((item) => {
                    const id = `${section.key}:${item.id}`
                    const active = id === selected
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          aria-current={active ? 'true' : undefined}
                          onClick={() => setSelected(id)}
                          className={`flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 border-0 border-b border-line py-2 pl-4 pr-2 text-left text-[15px] text-ink ${
                            active ? 'border-l-2 border-l-ink bg-sunken font-bold' : 'bg-transparent hover:bg-sunken'
                          }`}
                        >
                          <span className="min-w-0 truncate">{item.name}</span>
                          <span className="shrink-0 font-mono text-xs text-ink-muted">{item.count}</span>
                        </button>
                      </li>
                    )
                  })}
                  {(section.moreItems ?? 0) > 0 && <li className="py-2 pl-4 text-[15px] text-ink-muted">+ {section.moreItems} more</li>}
                </ul>
              )}
            </div>
          )
        })}
      </nav>

      {current && (
        <section aria-label="Selected" className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-col gap-3 border border-line-strong bg-sunken p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="m-0 font-display text-[28px] font-bold leading-[34px]">{current.name}</h2>
              <span className="font-mono text-xs text-ink-muted">
                {[periodOf(current), current.usedInResumes !== undefined && `Used in ${current.usedInResumes}`].filter(Boolean).join(' · ')}
              </span>
            </div>
            {current.skills && current.skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {current.skills.map((skill) => (
                  <Tag key={skill} tone="muted" className="px-2 py-1">
                    {skill}
                  </Tag>
                ))}
              </div>
            )}
          </div>

          <div>
            <ColumnHead>CONNECTED ENTRIES</ColumnHead>
            {current.entries.map((entry) => (
              <div key={`${entry.date}-${entry.text}`} className="grid gap-1 border-b border-line py-3.5 sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-4">
                <span className="font-mono text-xs text-ink-muted">
                  {formatDate(entry.date)}
                  <br />
                  {entry.source}
                </span>
                <Markdown className="text-[15px] leading-[22px]">{entry.text}</Markdown>
              </div>
            ))}
            {current.more > 0 && (
              <div className="grid gap-1 py-3.5 sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-4">
                <span className="font-mono text-xs text-ink-muted">+ {current.more}</span>
                <Link href="/dashboard/evidence" className="text-sm font-semibold">
                  See all in the evidence library
                </Link>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
