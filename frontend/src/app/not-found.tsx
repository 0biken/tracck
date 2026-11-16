import Link from 'next/link'
import { Logo } from '@/components/logo'
import { Eyebrow } from '@/components/page-header'
import { Button, buttonClass } from '@/components/ui/button'

export const metadata = { title: 'Page not found' }

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col px-5 py-7 sm:px-10">
      <div className="self-start">
        <Logo />
      </div>
      <main className="flex flex-1 items-center py-12">
        <div className="flex max-w-150 flex-col gap-5">
          <Eyebrow>Error 404</Eyebrow>
          <h1 className="t-h1 m-0 text-balance">We can&apos;t find that page.</h1>
          <p className="m-0 text-lg leading-7 text-ink-muted">
            The link may be old, or the page may have moved. Your proof of work and resumes are safe.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard" className={buttonClass('primary', 'lg')}>
              Go to home
            </Link>
            <Button href="/" variant="secondary" size="lg">
              Back to Tracck
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
