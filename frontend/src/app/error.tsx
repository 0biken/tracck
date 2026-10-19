'use client'

import Link from 'next/link'
import { Logo } from '@/components/logo'
import { Eyebrow } from '@/components/page-header'
import { Button, buttonClass } from '@/components/ui/button'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col px-5 py-7 sm:px-10">
      <div className="self-start">
        <Logo />
      </div>
      <main className="flex flex-1 items-center py-12">
        <div className="flex max-w-150 flex-col gap-5" role="alert">
          <Eyebrow>Something went wrong</Eyebrow>
          <h1 className="t-h1 m-0 text-balance">That did not load.</h1>
          <p className="m-0 text-lg leading-7 text-ink-muted">
            It is on our side, not yours, and your record is safe. Try again, and if it keeps happening, tell us what you
            were doing.
          </p>
          {error.digest && <p className="m-0 font-mono text-xs text-ink-muted">REFERENCE {error.digest}</p>}
          <div className="flex flex-wrap gap-3">
            <Button size="lg" onClick={reset}>
              Try again
            </Button>
            <Link href="/dashboard" className={buttonClass('secondary', 'lg')}>
              Go to home
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
