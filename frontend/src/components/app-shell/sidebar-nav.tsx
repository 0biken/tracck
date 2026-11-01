'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export interface NavCounts {
  resumes: number
  evidence: number
  sources: number
}

type Item =
  | { head: string }
  | { href: string; label: string; count?: string; match: (path: string) => boolean }

function userItems(counts: NavCounts, isStaff?: boolean): Item[] {
  const items: Item[] = [
    { href: '/dashboard', label: 'Home', match: (p) => p === '/dashboard' },
    {
      href: '/dashboard/resumes',
      label: 'Resumes',
      count: String(counts.resumes),
      match: (p) => p.startsWith('/dashboard/resumes') && !p.startsWith('/dashboard/resumes/new'),
    },
    { head: 'YOUR RECORD' },
    { href: '/dashboard/graph', label: 'Career Graph', match: (p) => p.startsWith('/dashboard/graph') },
    { href: '/dashboard/evidence', label: 'Evidence library', count: String(counts.evidence), match: (p) => p.startsWith('/dashboard/evidence') },
    { href: '/dashboard/sources', label: 'Sources', count: String(counts.sources), match: (p) => p.startsWith('/dashboard/sources') },
    { href: '/dashboard/feedback', label: 'CV feedback', match: (p) => p.startsWith('/dashboard/feedback') },
    { head: 'ACCOUNT' },
    { href: '/dashboard/settings', label: 'Settings and plan', match: (p) => p.startsWith('/dashboard/settings') },
  ]
  if (isStaff) {
    items.push(
      { head: 'STAFF' },
      { href: '/admin', label: 'Admin console', match: (p) => p.startsWith('/admin') },
    )
  }
  return items
}

const adminItems: Item[] = [
  { head: 'ADMIN CONSOLE' },
  { href: '/admin', label: 'Overview', match: (p) => p === '/admin' },
  { href: '/admin/users', label: 'Users', match: (p) => p.startsWith('/admin/users') },
  { href: '/admin/activity', label: 'Activity and queues', match: (p) => p.startsWith('/admin/activity') },
  { head: 'APP' },
  { href: '/dashboard', label: 'Back to dashboard', match: () => false },
]

export function SidebarNav({
  mode = 'user',
  counts,
  isStaff = false,
}: {
  mode?: 'user' | 'admin'
  counts: NavCounts
  isStaff?: boolean
}) {
  const pathname = usePathname()
  const items = mode === 'admin' ? adminItems : userItems(counts, isStaff)

  return (
    <nav aria-label={mode === 'admin' ? 'Admin console' : 'App'} className="flex flex-col gap-0.5">
      {items.map((item) => {
        if ('head' in item) {
          return (
            <div key={item.head} className="px-2 pb-1.5 pt-[18px] font-mono text-[11px] tracking-[0.16em] text-ink-muted" aria-hidden="true">
              {item.head}
            </div>
          )
        }
        const current = item.match(pathname)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? 'page' : undefined}
            className={`flex min-h-11 items-center justify-between border px-2.5 text-sm font-semibold tracking-[0.02em] no-underline lg:min-h-10 ${
              current ? 'border-line-strong bg-canvas text-ink' : 'border-transparent text-ink-muted hover:bg-canvas hover:text-ink'
            }`}
          >
            <span>{item.label}</span>
            {item.count && <span className="font-mono text-xs text-ink-muted">{item.count}</span>}
          </Link>
        )
      })}
    </nav>
  )
}
