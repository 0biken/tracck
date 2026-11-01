import { PageHeader } from '@/components/page-header'
import { serverApi } from '@/lib/api/server'
import { ActivityViews } from './activity-views'

export default async function AdminActivityPage() {
  const api = serverApi()
  const [audit, deletions, waitlist] = await Promise.all([
    api.admin.audit({ limit: 50 }),
    api.admin.deletionRequests(),
    api.admin.waitlist(),
  ])

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="ADMIN CONSOLE · COMPLIANCE & QUEUES" title="Activity and queues">
        Review security-relevant platform audit events, account deletion requests, and organisation waitlist entries.
      </PageHeader>

      <ActivityViews initialAudit={audit} deletions={deletions} waitlist={waitlist} />
    </div>
  )
}
