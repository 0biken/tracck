'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Logo } from '@/components/logo'
import { buttonClass } from '@/components/ui/button'

const links = [
  { href: '/#how', label: 'How it works' },
  { href: '/#sources', label: 'Sources' },
  { href: '/#orgs', label: 'For organisations' },
  { href: '/pricing', label: 'Pricing' },
]

export function MarketingHeader() {
  const pathname = usePathname()

  return (
    <header className="border-b border-line">
      <nav aria-label="Main" className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 sm:px-8">
        <Logo />

        <div className="order-last flex w-full flex-wrap justify-center gap-x-7 gap-y-1 sm:order-none sm:w-auto sm:flex-1">
          {links.map((link) => {
            const current = link.href === pathname
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={current ? 'page' : undefined}
                className={`inline-flex min-h-11 items-center text-sm font-semibold tracking-[0.02em] no-underline hover:text-signal ${
                  current ? 'underline underline-offset-[6px]' : ''
                }`}
              >
                {link.label}
              </Link>
            )
          })}
        </div>

        <div className="ml-auto flex gap-2 sm:ml-0">
          <Link href="/login" className={buttonClass('secondary', 'md')}>
            Log in
          </Link>
          <Link href="/signup" className={buttonClass('primary', 'md')}>
            Get started
          </Link>
        </div>
      </nav>
    </header>
  )
}
