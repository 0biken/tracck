import Link from 'next/link'
import { SOURCE_LABELS, type SourceProvider } from '@tracck/shared'
import { PageHeader, SectionHead } from '@/components/page-header'
import { StatGrid } from '@/components/stat-grid'
import { buttonClass } from '@/components/ui/button'
import { ScrollTable, tdClass, thClass } from '@/components/ui/table'
import { serverApi } from '@/lib/api/server'
import { formatCount } from '@/lib/format'

export default async function AdminOverviewPage() {
  const stats = await serverApi().admin.stats()
  const totalTokens = stats.aiLast30d.inputTokens + stats.aiLast30d.outputTokens

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        eyebrow="ADMIN CONSOLE · PLATFORM OVERVIEW"
        title="Platform operations"
        actions={
          <>
            <Link href="/admin/users" className={buttonClass('primary', 'md')}>
              Manage users ({formatCount(stats.users.total)})
            </Link>
            <Link href="/admin/activity" className={buttonClass('secondary', 'md')}>
              Activity and queues
            </Link>
          </>
        }
      >
        Live counts across user accounts, connected sources, generated resumes, background workers, and AI model calls.
      </PageHeader>

      <section aria-labelledby="users-heading" className="flex flex-col gap-4">
        <SectionHead
          id="users-heading"
          title="Users and plans"
          action={<Link href="/admin/users">View directory →</Link>}
        />
        <StatGrid
          label="Users and plans"
          stats={[
            {
              label: 'TOTAL USERS',
              value: formatCount(stats.users.total),
              note: `${formatCount(stats.users.onboarded)} completed onboarding`,
            },
            {
              label: 'PRO SUBSCRIBERS',
              value: formatCount(stats.users.pro),
              note: `${formatCount(Math.max(0, stats.users.total - stats.users.pro))} on Free plan`,
            },
            {
              label: 'NEW (7 / 30 DAYS)',
              value: `${formatCount(stats.users.newLast7d)} / ${formatCount(stats.users.newLast30d)}`,
              note: 'Signups in the last 7 and 30 days',
            },
            {
              label: 'SUSPENDED',
              value: formatCount(stats.users.suspended),
              note: stats.users.suspended > 0 ? 'Accounts currently blocked' : 'No accounts suspended',
            },
          ]}
        />
      </section>

      <section aria-labelledby="content-heading" className="flex flex-col gap-4">
        <SectionHead id="content-heading" title="Evidence and resumes" />
        <StatGrid
          label="Evidence and resumes"
          stats={[
            {
              label: 'CONNECTED SOURCES',
              value: formatCount(stats.content.sourcesTotal),
              note: 'Active non-revoked connections',
            },
            {
              label: 'EVIDENCE ITEMS',
              value: formatCount(stats.content.evidenceTotal),
              note: 'Entries across all Career Graphs',
            },
            {
              label: 'RESUMES GENERATED',
              value: formatCount(stats.content.resumesTotal),
              note: `${formatCount(stats.content.resumesExported)} exported to PDF/DOCX`,
            },
            {
              label: 'OPEN QUEUES',
              value: formatCount(stats.queues.openDeletionRequests),
              note: `${formatCount(stats.queues.waitlistEntries)} organisation waitlist signups`,
            },
          ]}
        />
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="jobs-heading" className="flex flex-col gap-4">
          <SectionHead id="jobs-heading" title="Background jobs (last 24h)" />
          <StatGrid
            label="Background jobs"
            stats={[
              {
                label: 'QUEUED / RUNNING',
                value: `${formatCount(stats.jobsLast24h.queued)} / ${formatCount(stats.jobsLast24h.running)}`,
                note: 'Currently active in worker queue',
              },
              {
                label: 'SUCCEEDED / FAILED (24H)',
                value: `${formatCount(stats.jobsLast24h.succeeded)} / ${formatCount(stats.jobsLast24h.failed)}`,
                note: stats.jobsLast24h.failed > 0 ? 'Check user job logs for failures' : 'Zero failed jobs in 24h',
              },
            ]}
          />
        </section>

        <section aria-labelledby="ai-heading" className="flex flex-col gap-4">
          <SectionHead id="ai-heading" title="AI engine (last 30d)" />
          <StatGrid
            label="AI engine usage"
            stats={[
              {
                label: 'MODEL CALLS',
                value: formatCount(stats.aiLast30d.calls),
                note: `${formatCount(stats.aiLast30d.failedCalls)} non-ok calls · ${formatCount(totalTokens)} tokens`,
              },
              {
                label: 'ESTIMATED COST (30D)',
                value: `$${stats.aiLast30d.estimatedCostUsd.toFixed(2)}`,
                note: `${formatCount(stats.aiLast30d.inputTokens)} in / ${formatCount(stats.aiLast30d.outputTokens)} out`,
              },
            ]}
          />
        </section>
      </div>

      <section aria-labelledby="sources-breakdown-heading" className="flex flex-col gap-4">
        <SectionHead id="sources-breakdown-heading" title="Connected sources by provider" />
        <ScrollTable minWidth={480} caption="Connected sources by provider">
          <thead>
            <tr>
              <th scope="col" className={thClass}>Provider</th>
              <th scope="col" className={thClass}>Active connections</th>
            </tr>
          </thead>
          <tbody>
            {(Object.entries(stats.content.sourcesByProvider) as [SourceProvider, number][]).map(
              ([provider, count]) => (
                <tr key={provider}>
                  <td className={tdClass}>
                    <span className="font-semibold">{SOURCE_LABELS[provider] ?? provider}</span>
                  </td>
                  <td className={`${tdClass} font-mono`}>{formatCount(count)}</td>
                </tr>
              ),
            )}
          </tbody>
        </ScrollTable>
      </section>
    </div>
  )
}
