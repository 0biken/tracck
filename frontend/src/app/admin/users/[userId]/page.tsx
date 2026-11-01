import Link from 'next/link'
import { serverApi } from '@/lib/api/server'
import { UserInspector } from './user-inspector'

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const { userId } = await params
  const api = serverApi()
  const [me, user] = await Promise.all([api.me.get(), api.admin.user(userId)])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/users" className="font-mono text-xs font-semibold tracking-[0.08em] text-ink-muted hover:text-ink">
          ← BACK TO USERS DIRECTORY
        </Link>
      </div>
      <UserInspector initial={user} viewerId={me.id} />
    </div>
  )
}
