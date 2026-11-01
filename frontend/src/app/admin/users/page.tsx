import { PageHeader } from '@/components/page-header'
import { serverApi } from '@/lib/api/server'
import { UsersDirectory } from './users-directory'

export default async function AdminUsersPage() {
  const initialPage = await serverApi().admin.users({ limit: 25 })

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="ADMIN CONSOLE · USER MANAGEMENT" title="Users directory">
        Search users by name, email, or ID, filter by plan or account status, and open any profile to inspect activity or
        manage entitlements.
      </PageHeader>

      <UsersDirectory initial={initialPage} />
    </div>
  )
}
