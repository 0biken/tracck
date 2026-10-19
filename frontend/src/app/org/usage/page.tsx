import Link from 'next/link'
import { PageHeader } from '@/components/page-header'
import { StatGrid } from '@/components/stat-grid'
import { buttonClass } from '@/components/ui/button'
import { RESUMES_PER_DAY, USAGE_STATS } from '@/lib/mock/org'
import { AuditLog } from './audit-log'

export const metadata = { title: 'Usage and audit' }

export default function OrgUsagePage() {
  const last = RESUMES_PER_DAY.length - 1

  return (
    <>
      <PageHeader eyebrow="Billing period 2026.10.01 to 2026.10.31" title="Usage and audit" />

      <StatGrid label="Usage this period" stats={USAGE_STATS.map((s) => ({ label: s.label, value: s.value, note: s.note }))} />

      <section aria-label="Resumes per day" className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="t-claim m-0">Resumes per day</h2>
          <span className="font-mono text-xs text-ink-muted">QUOTA PACE: 37% USED, 39% OF MONTH ELAPSED</span>
        </div>
        <figure
          className="m-0"
          aria-label="Bar chart of resumes generated per day. The latest day is still in progress and shown lighter."
        >
          <div className="grid h-35 grid-cols-12 items-end gap-1.5 border-b border-ink" aria-hidden="true">
            {RESUMES_PER_DAY.map((value, index) => (
              <div
                key={index}
                className={index === last ? 'bg-line-input' : 'bg-ink'}
                style={{ height: `${value}%` }}
              />
            ))}
          </div>
          <div className="mt-2 grid grid-cols-12 gap-1.5 font-mono text-[11px] text-ink-muted" aria-hidden="true">
            {RESUMES_PER_DAY.map((_, index) => (
              <span key={index}>{String(index + 1).padStart(2, '0')}</span>
            ))}
          </div>
        </figure>
      </section>

      <div
        role="status"
        className="flex flex-wrap items-center justify-between gap-3 border border-danger bg-danger-tint px-5 py-4"
      >
        <span className="text-[15px] leading-[22px]">
          <strong className="text-danger-ink">Unusual use on trk_test_c09e.</strong> 412 requests from a new address in 10
          minutes on 2026.10.08.
        </span>
        <Link href="/org/keys" className={buttonClass('secondary', 'md')}>
          Review key
        </Link>
      </div>

      <AuditLog />
    </>
  )
}
