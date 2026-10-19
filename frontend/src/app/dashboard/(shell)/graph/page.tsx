import Link from 'next/link'
import { ColumnHead, PageHeader } from '@/components/page-header'
import { Button, buttonClass } from '@/components/ui/button'
import { ACCOUNT } from '@/lib/mock/account'
import { MONTHS, SKILLS_BY_EVIDENCE } from '@/lib/mock/record'
import { GraphExplorer } from './graph-explorer'

export const metadata = { title: 'Career Graph' }

export default function CareerGraphPage() {
  return (
    <>
      <PageHeader
        eyebrow={`${ACCOUNT.entries} entries · ${ACCOUNT.projects} projects · ${ACCOUNT.skills} skills · Updated ${ACCOUNT.graphUpdated}`}
        title="Career Graph"
        actions={
          <>
            <Button variant="secondary">Refresh now</Button>
            <Link href="/dashboard/evidence" className={buttonClass('secondary', 'md')}>
              Evidence library
            </Link>
          </>
        }
      >
        Everything Tracck learned from your sources, organised by project and skill. Each resume uses only the entries
        ranked most relevant to that job.
      </PageHeader>

      <section aria-label="Activity by month" className="flex flex-col gap-2.5">
        <div className="t-eyebrow text-ink-muted">Entries by month · 2025.11 to 2026.10</div>
        <figure
          className="m-0"
          aria-label={`Bar chart of entries by month. Busiest month: ${MONTHS.reduce((a, b) => (b.v > a.v ? b : a)).m}.`}
        >
          <div className="grid h-24 grid-cols-12 items-end gap-1.5 border-b border-ink" aria-hidden="true">
            {MONTHS.map((month) => (
              <div key={month.m} className="bg-ink" style={{ height: `${month.v}%` }} />
            ))}
          </div>
          <div className="mt-2 grid grid-cols-12 gap-1.5 font-mono text-[11px] text-ink-muted" aria-hidden="true">
            {MONTHS.map((month) => (
              <span key={month.m} className="truncate">
                {month.m}
              </span>
            ))}
          </div>
        </figure>
      </section>

      <GraphExplorer />

      <section aria-label="Skills" className="flex flex-col gap-3">
        <ColumnHead>SKILLS BY EVIDENCE</ColumnHead>
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-x-8 gap-y-1 p-0">
          {SKILLS_BY_EVIDENCE.map(([name, count]) => (
            <li key={name} className="flex justify-between border-b border-line py-2">
              <span>{name}</span>
              <span className="font-mono text-[13px]">{count}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
