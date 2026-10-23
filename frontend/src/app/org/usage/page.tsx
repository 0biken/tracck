import Link from 'next/link'
import { PageHeader } from '@/components/page-header'
import { StatGrid } from '@/components/stat-grid'
import { buttonClass } from '@/components/ui/button'
import { serverApi } from '@/lib/api/server'
import { formatCount, formatDate } from '@/lib/format'
import { ClientPicker } from '../client-picker'
import { loadClients } from '../clients'
import { AuditLog } from './audit-log'

export const metadata = { title: 'Usage and audit' }

export default async function OrgUsagePage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const { clients, current } = await loadClients((await searchParams).client)
  if (!current) {
    return (
      <>
        <PageHeader eyebrow="No organisation yet" title="Usage and audit" actions={<ClientPicker clients={clients} current={null} />} />
        <p className="m-0 border border-line p-6 text-[15px] text-ink-muted">Add an organisation to see how it uses the API.</p>
      </>
    )
  }

  const api = serverApi()
  const [usage, keys, events] = await Promise.all([api.admin.usage(current.id), api.admin.keys(current.id), api.admin.audit(current.id)])
  const peak = Math.max(1, ...usage.perDay)
  const today = new Date().getUTCDate()

  return (
    <>
      <PageHeader
        eyebrow={`${current.name} · billing period ${formatDate(usage.period.from)} to ${formatDate(usage.period.to)}`}
        title="Usage and audit"
        actions={<ClientPicker clients={clients} current={current.id} />}
      />

      <StatGrid
        label="Usage this period"
        stats={[
          { label: 'Resumes generated', value: formatCount(usage.resumesGenerated), note: `of ${formatCount(usage.quota)} quota` },
          { label: 'API requests', value: formatCount(usage.apiRequests), note: `${usage.successRate}% succeeded` },
          { label: 'Students consented', value: usage.studentsConsented, note: `${usage.consentsRevoked} revoked this month` },
          { label: 'Rate limited', value: usage.rateLimited, note: usage.rateLimited ? 'Calls refused with 429' : 'None' },
        ]}
      />

      <section aria-label="Resumes per day" className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="t-claim m-0">Resumes per day</h2>
          <span className="font-mono text-xs text-ink-muted">
            QUOTA PACE: {usage.quotaUsedPercent}% USED, {usage.monthElapsedPercent}% OF MONTH ELAPSED
          </span>
        </div>
        <figure
          className="m-0"
          aria-label={`Bar chart of resumes generated per day. ${usage.resumesGenerated} so far this month. Today is still in progress and shown lighter.`}
        >
          <div className="grid h-35 items-end gap-1 border-b border-ink" style={{ gridTemplateColumns: `repeat(${usage.perDay.length}, minmax(0, 1fr))` }} aria-hidden="true">
            {usage.perDay.map((value, index) => (
              <div
                key={index}
                className={index + 1 === today ? 'bg-line-input' : 'bg-ink'}
                style={{ height: `${Math.max(value ? 4 : 0, Math.round((value / peak) * 100))}%` }}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between font-mono text-[11px] text-ink-muted" aria-hidden="true">
            <span>01</span>
            <span>{String(Math.ceil(usage.perDay.length / 2)).padStart(2, '0')}</span>
            <span>{String(usage.perDay.length).padStart(2, '0')}</span>
          </div>
        </figure>
      </section>

      {usage.alerts.map((alert) => (
        <div key={`${alert.keyPrefix}-${alert.message}`} role="status" className="flex flex-wrap items-center justify-between gap-3 border border-danger bg-danger-tint px-5 py-4">
          <span className="text-[15px] leading-[22px]">
            <strong className="text-danger-ink">{alert.keyPrefix}</strong> {alert.message}
          </span>
          <Link href={`/org/keys?client=${current.id}`} className={buttonClass('secondary', 'md')}>
            Review key
          </Link>
        </div>
      ))}

      <AuditLog clientId={current.id} initial={events} keys={keys} />
    </>
  )
}
