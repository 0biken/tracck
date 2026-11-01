import Link from 'next/link'
import type { ReactNode } from 'react'
import { AppShell } from '@/components/app-shell/app-shell'
import { buttonClass } from '@/components/ui/button'
import { serverApi } from '@/lib/api/server'
import { viewerFromMe } from '@/lib/viewer'

/** The Tracck staff console. Non-staff accounts see a clear restriction notice. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const me = await serverApi().me.get()

  return (
    <AppShell mode="admin" viewer={viewerFromMe(me)} isStaff={me.staff}>
      {me.staff ? (
        children
      ) : (
        <div className="flex max-w-140 flex-col gap-4 border-t-2 border-ink pt-7">
          <h1 className="t-h2 m-0">This area is for the Tracck team</h1>
          <p className="m-0 text-base leading-6 text-ink-muted">
            Your account does not have staff access. If you are on the Tracck team, add your user ID or email to
            STAFF_USER_IDS or STAFF_EMAILS in the backend environment.
          </p>
          <div>
            <Link href="/dashboard" className={buttonClass('secondary', 'md')}>
              Back to your dashboard
            </Link>
          </div>
        </div>
      )}
    </AppShell>
  )
}
