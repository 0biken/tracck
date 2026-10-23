import { Plus } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { signout } from '@/app/auth/actions'
import { Logo } from '@/components/logo'
import { buttonClass } from '@/components/ui/button'
import { Meter } from '@/components/ui/meter'
import type { Viewer } from '@/lib/viewer'
import { MobileNav } from './mobile-nav'
import { SidebarNav, type NavCounts } from './sidebar-nav'

export interface ShellPlan {
  /** "Free" or "Pro". */
  name: string
  used: number
  /** Null when the plan has no monthly limit. */
  limit: number | null
  /** ISO date the allowance resets. */
  resetsOn: string
}

const noCounts: NavCounts = { resumes: 0, evidence: 0, sources: 0 }

function SidebarContent({
  mode,
  viewer,
  counts,
  plan,
}: {
  mode: 'user' | 'org'
  viewer: Viewer
  counts: NavCounts
  plan: ShellPlan | null
}) {
  const isOrg = mode === 'org'

  return (
    <div className="flex min-h-full flex-1 flex-col gap-6 p-4 pt-5">
      <div className="px-2">
        <Logo href={isOrg ? '/org/keys' : '/dashboard'} size="sm" badge={isOrg ? 'STAFF' : undefined} />
      </div>

      {!isOrg && (
        <Link href="/dashboard/resumes/new" className={buttonClass('primary', 'md', 'w-full')}>
          <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
          New resume
        </Link>
      )}

      <SidebarNav mode={mode} counts={counts} />

      <div className="mt-auto flex flex-col gap-3">
        {!isOrg && plan && (
          <div className="flex flex-col gap-2 border border-line-strong bg-canvas p-3">
            <div className="flex justify-between text-[13px]">
              <span className="font-semibold">{plan.name} plan</span>
              <span className="font-mono text-ink-muted">
                {plan.limit === null ? `${plan.used} this month` : `${plan.used} / ${plan.limit}`}
              </span>
            </div>
            {plan.limit !== null && (
              <Meter
                value={Math.min(100, (plan.used / plan.limit) * 100)}
                label={`${plan.used} of ${plan.limit} resumes used this month`}
              />
            )}
            <span className="text-xs leading-[17px] text-ink-muted">
              {plan.limit === null
                ? 'Resumes this month. No limit on your plan.'
                : `Resumes this month. Resets ${plan.resetsOn.replaceAll('-', '.')}.`}
            </span>
            {plan.limit !== null && (
              <Link href="/dashboard/settings" className="text-[13px] font-semibold">
                Upgrade to Pro
              </Link>
            )}
          </div>
        )}

        <div className="flex items-center gap-2.5 border-t border-line p-2 pt-3">
          <span
            aria-hidden="true"
            className="grid size-8 shrink-0 place-items-center bg-ink text-[13px] font-bold text-canvas"
          >
            {viewer.initials}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-semibold">{viewer.name}</span>
            <span className="truncate font-mono text-[11px] text-ink-muted">{viewer.email}</span>
          </span>
          <form action={signout}>
            <button
              type="submit"
              className="min-h-9 cursor-pointer border-0 bg-transparent px-1 text-xs font-semibold text-ink-muted underline hover:text-ink"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

/**
 * The frame around every signed-in screen: a sticky side menu from 1024px up, a
 * top bar with a menu drawer below that. `mode="org"` swaps the menu for the
 * staff console one.
 */
export function AppShell({
  mode = 'user',
  viewer,
  counts = noCounts,
  plan = null,
  children,
}: {
  mode?: 'user' | 'org'
  viewer: Viewer
  counts?: NavCounts
  plan?: ShellPlan | null
  children: ReactNode
}) {
  const content = <SidebarContent mode={mode} viewer={viewer} counts={counts} plan={plan} />

  return (
    <div className="min-h-dvh lg:flex">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-canvas focus:px-3 focus:py-2 focus:outline-2 focus:outline-signal"
      >
        Skip to content
      </a>

      <aside className="sticky top-0 hidden h-dvh w-62 shrink-0 overflow-y-auto border-r border-line bg-sunken lg:flex">
        {content}
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-canvas px-4 py-2 lg:hidden">
          <MobileNav>{content}</MobileNav>
          <div className="flex-1 px-1">
            <Logo href={mode === 'org' ? '/org/keys' : '/dashboard'} size="sm" badge={mode === 'org' ? 'STAFF' : undefined} />
          </div>
          {mode === 'user' && (
            <Link href="/dashboard/resumes/new" className={buttonClass('primary', 'md', 'px-3.5')}>
              <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
              New<span className="sr-only"> resume</span>
            </Link>
          )}
        </header>

        <main id="content" className="px-4 pb-16 pt-6 sm:px-8 lg:px-10 lg:pt-8">
          <div className={`mx-auto flex w-full flex-col gap-8 ${mode === 'org' ? 'max-w-[1120px]' : 'max-w-[1080px]'}`}>
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
