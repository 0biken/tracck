'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ACCOUNT } from '@/lib/mock/account'

type Item =
  | { head: string }
  | { href: string; label: string; count?: string; match: (path: string) => boolean }

const userItems: Item[] = [
  { href: '/dashboard', label: 'Home', match: (p) => p === '/dashboard' },
  {
    href: '/dashboard/resumes',
    label: 'Resumes',
    count: String(ACCOUNT.resumes),
    match: (p) => p.startsWith('/dashboard/resumes') && !p.startsWith('/dashboard/resumes/new'),
  },
  { head: 'YOUR RECORD' },
  { href: '/dashboard/graph', label: 'Career Graph', match: (p) => p.startsWith('/dashboard/graph') },
  { href: '/dashboard/evidence', label: 'Evidence library', count: String(ACCOUNT.entries), match: (p) => p.startsWith('/dashboard/evidence') },
  { href: '/dashboard/sources', label: 'Sources', count: String(ACCOUNT.sourcesTotal), match: (p) => p.startsWith('/dashboard/sources') },
  { href: '/dashboard/feedback', label: 'CV feedback', match: (p) => p.startsWith('/dashboard/feedback') },
  { head: 'ACCOUNT' },
  { href: '/dashboard/settings', label: 'Settings and plan', match: (p) => p.startsWith('/dashboard/settings') },
]

const orgItems: Item[] = [
  { head: 'UNILAG CAREERS' },
  { href: '/org/keys', label: 'API keys', count: '3', match: (p) => p.startsWith('/org/keys') },
  { href: '/org/usage', label: 'Usage and audit', match: (p) => p.startsWith('/org/usage') },
  { head: 'DOCS' },
  { href: '/org/docs', label: 'API reference', match: (p) => p.startsWith('/org/docs') },
  { href: '/consent', label: 'Consent flow', match: (p) => p.startsWith('/consent') },
]

export function SidebarNav({ mode }: { mode: 'user' | 'org' }) {
  const pathname = usePathname()
  const items = mode === 'org' ? orgItems : userItems

  return (
    <nav aria-label={mode === 'org' ? 'Organisation' : 'App'} className="flex flex-col gap-0.5">
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
