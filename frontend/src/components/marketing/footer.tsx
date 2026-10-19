import Link from 'next/link'

const columns = [
  {
    title: 'Product',
    links: [
      { href: '/#how', label: 'How it works' },
      { href: '/#sources', label: 'Sources' },
      { href: '/pricing', label: 'Pricing' },
    ],
  },
  {
    title: 'Roles',
    links: [
      { href: '/#roles', label: 'Developers' },
      { href: '/#roles', label: 'Designers' },
      { href: '/#roles', label: 'Community and Dev Rel' },
    ],
  },
  {
    title: 'Organisations',
    links: [
      { href: '/#orgs', label: 'API' },
      { href: '/waitlist', label: 'Waitlist' },
    ],
  },
  {
    title: 'Trust',
    links: [
      { href: '/privacy', label: 'Privacy' },
      { href: '/terms', label: 'Terms' },
      { href: '/data-deletion', label: 'Data deletion' },
    ],
  },
]

export function MarketingFooter() {
  return (
    <footer className="border-t-2 border-ink bg-sunken">
      <div className="mx-auto grid max-w-[1200px] grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-8 px-5 py-14 sm:px-8">
        <div className="flex flex-col gap-3">
          <span className="font-display text-2xl font-black tracking-[-0.03em]">Tracck</span>
          <span className="text-[15px] leading-[22px] text-ink-muted">Your wins. Always ready.</span>
        </div>
        {columns.map((column) => (
          <div key={column.title} className="flex flex-col gap-1 text-[15px]">
            <span className="t-eyebrow mb-1 text-ink-muted">{column.title}</span>
            {column.links.map((link) => (
              <Link key={link.label} href={link.href} className="inline-flex min-h-8 items-center no-underline hover:text-signal hover:underline">
                {link.label}
              </Link>
            ))}
          </div>
        ))}
      </div>
      <div className="mx-auto max-w-[1200px] border-t border-line px-5 pb-8 pt-4 sm:px-8">
        <span className="font-mono text-xs text-ink-muted">© 2026 TRACCK · IBADAN, NIGERIA</span>
      </div>
    </footer>
  )
}
