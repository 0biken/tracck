import Link from 'next/link'
import type { ReactNode } from 'react'
import { AppShell } from '@/components/app-shell/app-shell'
import { buttonClass } from '@/components/ui/button'
import { serverApi } from '@/lib/api/server'
import { viewerFromMe } from '@/lib/viewer'

/** The staff console. Only people listed as Tracck staff see more than a notice. */
export default async function OrgLayout({ children }: { children: ReactNode }) {
  const me = await serverApi().me.get()

  return (
    <AppShell mode="org" viewer={viewerFromMe(me)}>
      {me.staff ? (
        children
      ) : (
        <div className="flex max-w-140 flex-col gap-4 border-t-2 border-ink pt-7">
          <h1 className="t-h2 m-0">This area is for the Tracck team</h1>
          <p className="m-0 text-base leading-6 text-ink-muted">
            Organisations manage their access through the Tracck team. If you are part of one, contact us to get set up.
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
