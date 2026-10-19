import Link from 'next/link'
import type { ReactNode } from 'react'
import { Eyebrow } from '@/components/page-header'
import { Alert } from '@/components/ui/alert'

export type LegalSection = { id: string; title: string; body: ReactNode }

const pages = [
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/data-deletion', label: 'Data deletion' },
]

/**
 * Layout for Terms, Privacy and Data deletion: a title, a contents list that
 * sticks beside long text on wide screens, and numbered sections.
 */
export function LegalPage({
  eyebrow,
  title,
  lede,
  current,
  sections,
}: {
  eyebrow: string
  title: string
  lede: string
  current: string
  sections: LegalSection[]
}) {
  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-10 px-5 pb-24 pt-14 sm:px-8 sm:pt-20">
      <div className="flex max-w-190 flex-col gap-4">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="t-h1 m-0 text-balance">{title}</h1>
        <p className="m-0 text-lg leading-7 text-ink-muted">{lede}</p>
      </div>

      <Alert tone="warning" title="Draft for legal review">
        This page describes how Tracck is designed to work. It has not been reviewed by a lawyer yet, and items in
        [BRACKETS] still need a decision before launch.
      </Alert>

      <div className="grid items-start gap-10 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16">
        <nav aria-label="On this page" className="flex flex-col gap-5 lg:sticky lg:top-6">
          <div className="flex flex-col">
            <div className="t-eyebrow pb-2 text-ink-muted">On this page</div>
            {sections.map((section, index) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="inline-flex min-h-9 items-center gap-2 border-b border-line text-sm no-underline hover:text-signal"
              >
                <span className="font-mono text-xs text-ink-muted">{String(index + 1).padStart(2, '0')}</span>
                {section.title}
              </a>
            ))}
          </div>
          <div className="flex flex-col">
            <div className="t-eyebrow pb-2 text-ink-muted">Related</div>
            {pages
              .filter((page) => page.href !== current)
              .map((page) => (
                <Link key={page.href} href={page.href} className="inline-flex min-h-9 items-center text-sm font-semibold">
                  {page.label}
                </Link>
              ))}
          </div>
        </nav>

        <div className="flex max-w-170 flex-col">
          {sections.map((section, index) => (
            <section
              key={section.id}
              id={section.id}
              aria-labelledby={`${section.id}-h`}
              className="scroll-mt-6 border-t-2 border-ink py-8 first:border-t-2"
            >
              <h2 id={`${section.id}-h`} className="t-claim m-0 mb-4">
                <span className="mr-3 font-mono text-[13px] font-normal text-ink-muted">
                  {String(index + 1).padStart(2, '0')}
                </span>
                {section.title}
              </h2>
              <div className="flex flex-col gap-3 text-base leading-[26px] text-ink-muted [&_a]:text-ink [&_a]:underline [&_li]:pl-1 [&_strong]:text-ink [&_ul]:m-0 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-5">
                {section.body}
              </div>
            </section>
          ))}
          <div className="border-t border-line pt-5 font-mono text-xs text-ink-muted">
            LAST UPDATED 2026.10.19 · QUESTIONS: [CONTACT EMAIL TO CONFIRM]
          </div>
        </div>
      </div>
    </main>
  )
}
