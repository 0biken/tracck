import { Check } from 'lucide-react'
import Link from 'next/link'
import { Eyebrow } from '@/components/page-header'
import { Button, buttonClass } from '@/components/ui/button'
import { Meter } from '@/components/ui/meter'
import { COLLECTION } from '@/lib/mock/record'
import { getViewer } from '@/lib/viewer'

export const metadata = { title: 'Building your record' }

const rowBase =
  'grid grid-cols-1 items-center gap-2 border-b border-line py-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] sm:gap-6 sm:py-[22px]'

export default async function OnboardStatusPage() {
  const viewer = await getViewer()

  return (
    <>
      <div className="flex max-w-190 flex-col gap-3">
        <Eyebrow>Step 3 of 3</Eyebrow>
        <h1 className="t-h1 m-0 text-balance">Building your record.</h1>
        <p className="m-0 text-lg leading-7 text-ink-muted">
          You don&apos;t have to wait here. We&apos;ll email {viewer.email} when your first source is ready. You can
          generate as soon as one source finishes.
        </p>
      </div>

      <section role="status" aria-live="polite" aria-label="Collection progress">
        <div
          className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] gap-6 border-b-2 border-ink pb-3 text-xs font-bold tracking-[0.08em] sm:grid"
          aria-hidden="true"
        >
          <span>SOURCE</span>
          <span>PROGRESS</span>
          <span>STATUS</span>
        </div>

        {COLLECTION.map((source) => {
          if (source.state === 'problem') {
            return (
              <div key={source.name} className={`${rowBase} border-danger bg-danger-tint px-4`}>
                <span className="text-[17px] font-bold">{source.name}</span>
                <span className="text-sm leading-[21px]">{source.detail}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[13px] text-danger-ink">{source.label}</span>
                  <Button variant="secondary" size="sm">
                    Retry
                  </Button>
                </div>
              </div>
            )
          }
          const ready = source.state === 'ready'
          return (
            <div key={source.name} className={`${rowBase} ${ready ? 'border-signal bg-signal-tint px-4' : ''}`}>
              <span className="text-[17px] font-bold">{source.name}</span>
              <div className="flex flex-col gap-1.5">
                <Meter
                  value={source.progress}
                  tone={ready ? 'signal' : 'ink'}
                  label={`${source.name} progress`}
                  className={ready ? '!bg-signal/25' : ''}
                />
                <span className={`font-mono text-xs ${ready ? '' : 'text-ink-muted'}`}>{source.detail}</span>
              </div>
              <span
                className={`font-mono text-[13px] ${ready ? 'text-signal' : source.state === 'waiting' ? 'text-ink-muted' : ''}`}
              >
                {source.label}
              </span>
            </div>
          )
        })}
      </section>

      <div className="flex items-start gap-3 border border-signal bg-signal-tint px-5 py-4">
        <Check className="mt-0.5 size-5 shrink-0 text-signal" strokeWidth={2} aria-hidden="true" />
        <span className="text-[15px] leading-[22px]">
          <strong className="text-signal">Your record is ready.</strong> GitHub finished. Paste a job description now;
          Tracck will use the other sources when they finish.
        </span>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/dashboard/resumes/new" className={buttonClass('primary', 'lg')}>
          Paste a job description
        </Link>
        <Link href="/dashboard" className={buttonClass('secondary', 'lg')}>
          Go to home
        </Link>
      </div>
    </>
  )
}
