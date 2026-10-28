import Link from 'next/link'
import { ColumnHead, PageHeader } from '@/components/page-header'
import { buttonClass } from '@/components/ui/button'
import { serverApi } from '@/lib/api/server'
import { formatCount, formatDate } from '@/lib/format'
import { GraphBrowser } from './graph-browser'
import { RefreshButton } from './refresh-button'

export const metadata = { title: 'Career Graph' }

const monthLabel = (month: string) => month.replace('-', '.')

export default async function CareerGraphPage() {
  const graph = await serverApi().graph()
  const busiest = graph.months.reduce((a, b) => (b.count > a.count ? b : a), graph.months[0])
  const peak = Math.max(1, busiest?.count ?? 0)
  const projectCount = graph.projects.length + graph.moreProjects

  return (
    <>
      <PageHeader
        eyebrow={`${formatCount(graph.entries)} entries · ${projectCount} projects · ${graph.skills.length} skills${graph.updatedAt ? ` · Updated ${formatDate(graph.updatedAt)}` : ''}`}
        title="Career Graph"
        actions={
          <>
            <RefreshButton />
            <Link href="/dashboard/evidence" className={buttonClass('secondary', 'md')}>
              Evidence library
            </Link>
          </>
        }
      >
        Everything Tracck learned from your sources, organised by project and skill. Each resume uses only the entries
        ranked most relevant to that job.
      </PageHeader>

      {graph.entries === 0 ? (
        <p className="m-0 border border-line p-6 text-[15px] text-ink-muted">
          Your graph builds as sources finish collecting. <Link href="/dashboard/sources">Connect a source</Link> to start.
        </p>
      ) : (
        <>
          <section aria-label="Activity by month" className="flex flex-col gap-2.5">
            <div className="t-eyebrow text-ink-muted">
              Entries by month · {monthLabel(graph.months[0].month)} to {monthLabel(graph.months[graph.months.length - 1].month)}
            </div>
            <figure
              className="m-0"
              aria-label={`Bar chart of entries by month. Busiest month: ${monthLabel(busiest.month)}, ${busiest.count} entries.`}
            >
              <div className="grid h-24 grid-cols-12 items-end gap-1.5 border-b border-ink" aria-hidden="true">
                {graph.months.map((month) => (
                  <div key={month.month} className="bg-ink" style={{ height: `${Math.round((month.count / peak) * 100)}%` }} />
                ))}
              </div>
              <div className="mt-2 grid grid-cols-12 gap-1.5 font-mono text-[11px] text-ink-muted" aria-hidden="true">
                {graph.months.map((month) => (
                  <span key={month.month} className="truncate">
                    {month.month.slice(5)}
                  </span>
                ))}
              </div>
            </figure>
          </section>

          <GraphBrowser
            sections={[
              { key: 'experience', label: 'Work experience', items: graph.experience },
              { key: 'projects', label: 'Projects', items: graph.projects, moreItems: graph.moreProjects },
              { key: 'certifications', label: 'Certifications', items: graph.certifications },
            ].filter((section) => section.items.length > 0)}
          />

          <section aria-label="Skills" className="flex flex-col gap-3">
            <ColumnHead>SKILLS BY EVIDENCE</ColumnHead>
            <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-x-8 gap-y-1 p-0">
              {graph.skills.map((skill) => (
                <li key={skill.name} className="flex justify-between border-b border-line py-2">
                  <span>{skill.name}</span>
                  <span className="font-mono text-[13px]">{skill.count}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </>
  )
}
