'use client'

import { Briefcase, FileText, House, Link2, ListChecks, type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Five destinations, in the same order everywhere (design system, "App shell").
const destinations: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/dashboard', label: 'Overview', icon: House },
  { href: '/dashboard/accounts', label: 'Sources', icon: Link2 },
  { href: '/dashboard/queue', label: 'Review', icon: ListChecks },
  { href: '/dashboard/tailoring', label: 'Roles', icon: Briefcase },
  { href: '/dashboard/resumes', label: 'Resumes', icon: FileText },
]

function isCurrent(pathname: string, href: string) {
  return href === '/dashboard' ? pathname === href : pathname.startsWith(href)
}

/** Left sidebar links, shown from 1024px up. */
export function SidebarNav() {
  const pathname = usePathname()
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {destinations.map(({ href, label, icon: Icon }) => {
        const current = isCurrent(pathname, href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? 'page' : undefined}
            className={`flex min-h-10 items-center gap-3 rounded-md px-3 text-label transition-colors duration-150 ease-standard ${
              current
                ? 'bg-accent-tint font-semibold text-accent-ink'
                : 'font-medium text-ink-muted hover:bg-sunken hover:text-ink'
            }`}
          >
            <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

/** Bottom tab bar, shown below 1024px. */
export function TabBarNav() {
  const pathname = usePathname()
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t border-line bg-surface lg:hidden"
    >
      {destinations.map(({ href, label, icon: Icon }) => {
        const current = isCurrent(pathname, href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? 'page' : undefined}
            className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-0.5 text-caption ${
              current ? 'font-semibold text-accent-ink' : 'font-medium text-ink-muted'
            }`}
          >
            {current && (
              <span aria-hidden="true" className="absolute inset-x-1/5 top-0 h-0.5 rounded-b-sm bg-accent" />
            )}
            <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
