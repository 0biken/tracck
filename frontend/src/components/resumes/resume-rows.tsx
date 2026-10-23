import Link from 'next/link'
import type { ResumeSummaryView } from '@tracck/shared'
import { Tag } from '@/components/ui/badge'
import { ScrollTable, tdClass, thClass } from '@/components/ui/table'
import { formatDate } from '@/lib/format'
import { LENGTH_LABEL, roleName } from '@/lib/resumes'

export function StatusTag({ resume, long = false }: { resume: ResumeSummaryView; long?: boolean }) {
  if (resume.status === 'exported') return <Tag tone="signal">EXPORTED</Tag>
  if (resume.status === 'failed') return <Tag tone="danger">FAILED · RETRY</Tag>
  if (resume.status === 'generating') return <Tag>WRITING…</Tag>
  return <Tag>{long && resume.newEntries > 0 ? `DRAFT · ${resume.newEntries} NEW ${resume.newEntries === 1 ? 'ENTRY' : 'ENTRIES'}` : 'DRAFT'}</Tag>
}

function hrefFor(resume: ResumeSummaryView) {
  return resume.status === 'failed' || resume.status === 'generating'
    ? `/dashboard/resumes/${resume.id}/generating`
    : `/dashboard/resumes/${resume.id}`
}

const nameOf = (resume: ResumeSummaryView) => resume.company || resume.title

/**
 * Resumes as a table from 768px up, and as stacked cards below it. `compact` is
 * the short list on Home; the full one adds role, created date and an action.
 */
export function ResumeRows({ items, compact = false }: { items: ResumeSummaryView[]; compact?: boolean }) {
  if (items.length === 0) {
    return <p className="m-0 border border-line p-6 text-center text-[15px] text-ink-muted">No resumes match.</p>
  }

  return (
    <>
      <div className="hidden md:block">
        <ScrollTable caption={compact ? 'Recent resumes' : 'Resumes'} minWidth={compact ? 480 : 760}>
          <thead>
            <tr>
              <th className={thClass}>{compact ? 'Job' : 'Resume for'}</th>
              {!compact && <th className={thClass}>Role</th>}
              <th className={thClass}>Length</th>
              <th className={thClass}>Score</th>
              {!compact && <th className={thClass}>Created</th>}
              <th className={thClass}>Status</th>
              {!compact && (
                <th className={thClass}>
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {items.map((resume) => (
              <tr key={resume.id}>
                <td className={tdClass}>
                  <Link href={hrefFor(resume)} className="font-bold no-underline hover:underline">
                    {compact ? resume.title : nameOf(resume)}
                  </Link>
                  <div className={compact ? 'font-mono text-xs text-ink-muted' : 'text-[13px] text-ink-muted'}>
                    {compact ? `${nameOf(resume).toUpperCase()} · ${formatDate(resume.createdAt)}` : resume.title}
                  </div>
                </td>
                {!compact && <td className={tdClass}>{roleName(resume.role) || '—'}</td>}
                <td className={tdClass}>{LENGTH_LABEL[resume.length]}</td>
                <td className={`${tdClass} font-mono`}>{resume.score ?? '—'}</td>
                {!compact && <td className={`${tdClass} font-mono text-[13px]`}>{formatDate(resume.createdAt)}</td>}
                <td className={tdClass}>
                  <StatusTag resume={resume} long={!compact} />
                </td>
                {!compact && (
                  <td className={tdClass}>
                    <Link href={hrefFor(resume)} className="text-sm font-semibold">
                      {resume.status === 'failed' ? 'Retry' : 'Open'}
                    </Link>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </ScrollTable>
      </div>

      <ul className="m-0 flex list-none flex-col border-t-2 border-ink p-0 md:hidden">
        {items.map((resume) => (
          <li key={resume.id} className="flex flex-col gap-2 border-b border-line py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={hrefFor(resume)} className="font-bold no-underline hover:underline">
                  {nameOf(resume)}
                </Link>
                <div className="text-[13px] text-ink-muted">{resume.title}</div>
              </div>
              <span className="font-mono text-lg">{resume.score ?? '—'}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-ink-muted">
              <StatusTag resume={resume} long />
              <span>{LENGTH_LABEL[resume.length]}</span>
              <span className="font-mono">{formatDate(resume.createdAt)}</span>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
