'use client'

import { Check, CircleAlert } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Eyebrow } from '@/components/page-header'
import { buttonClass } from '@/components/ui/button'
import { EVIDENCE_IN_USE, GENERATION_STEPS } from '@/lib/mock/resumes'

const STEP_MS = 2200

/**
 * The generation progress screen. The steps advance on a timer here because no
 * resume job exists yet. Once the API reports real steps, drive this from
 * `useJob` (src/lib/use-job.ts) like the Overview test job does.
 */
export function GeneratingView({
  resumeId,
  eyebrow,
  lengthLabel,
}: {
  resumeId: string
  eyebrow: string
  lengthLabel: string
}) {
  const [done, setDone] = useState(0)
  const total = GENERATION_STEPS.length
  const finished = done >= total

  useEffect(() => {
    if (finished) return
    const timer = window.setTimeout(() => setDone((count) => count + 1), STEP_MS)
    return () => window.clearTimeout(timer)
  }, [done, finished])

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,440px),1fr))] items-start gap-12">
      <section className="flex min-w-0 flex-col gap-7">
        <div className="flex flex-col gap-2">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="t-h2 m-0">{finished ? 'Your draft is ready' : 'Writing your resume'}</h1>
          <p className="m-0 text-[17px] leading-[26px] text-ink-muted">
            You can stay or leave. This screen updates when the draft is ready, and we email you a link either way.
          </p>
        </div>

        <ol className="m-0 list-none border-t-2 border-ink p-0">
          {GENERATION_STEPS.map((step, index) => {
            const complete = index < done
            const current = index === done && !finished
            return (
              <li
                key={step.title}
                aria-current={current ? 'step' : undefined}
                className={`grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-4 border-b py-[18px] ${
                  current ? 'border-line-strong bg-sunken px-3' : 'border-line'
                } ${!complete && !current ? 'text-ink-muted' : ''}`}
              >
                <span
                  className={`grid size-7 place-items-center font-mono text-xs ${
                    complete ? 'bg-signal text-on-signal' : current ? 'border-2 border-ink font-medium' : 'border border-line-input'
                  }`}
                >
                  {complete ? <Check className="size-4" strokeWidth={2.5} aria-hidden="true" /> : index + 1}
                </span>
                <div>
                  <div className={current ? 'font-bold' : 'font-semibold'}>
                    {step.title === 'Formatting to one page' && lengthLabel === 'Full' ? 'Formatting to full length' : step.title}
                  </div>
                  {current && <div className="text-sm text-ink-muted">In progress</div>}
                  {complete && step.done && <div className="text-sm text-ink-muted">{step.done}</div>}
                </div>
                <span className="font-mono text-xs text-ink-muted">{complete ? step.time || '—' : '—'}</span>
              </li>
            )
          })}
        </ol>

        <div role="status" aria-live="polite" className="sr-only">
          {finished ? 'Your draft is ready.' : `Step ${done + 1} of ${total}: ${GENERATION_STEPS[done].title}`}
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard" className={buttonClass('secondary', 'md')}>
            Leave and email me
          </Link>
          {finished ? (
            <Link href={`/dashboard/resumes/${resumeId}`} className={buttonClass('primary', 'md')}>
              Open draft
            </Link>
          ) : (
            <span aria-disabled="true" className={`${buttonClass('primary', 'md')} opacity-50`}>
              Open draft
            </span>
          )}
        </div>

        <div className="flex items-start gap-3 border border-line p-4">
          <CircleAlert className="mt-0.5 size-5 shrink-0 text-ink-muted" strokeWidth={2} aria-hidden="true" />
          <span className="text-[15px] leading-[22px]">
            LinkedIn is still being collected. This resume uses GitHub and your CV. You can regenerate once LinkedIn is
            ready.
          </span>
        </div>
      </section>

      <section className="flex min-w-0 flex-col gap-4" aria-label="Evidence being used">
        <Eyebrow>Evidence being used · 24 entries</Eyebrow>
        <div className="border-t border-line">
          {EVIDENCE_IN_USE.map((item) => (
            <div key={item.where} className="flex flex-col gap-1 border-b border-line py-3.5">
              <span className="font-mono text-xs text-ink-muted">{item.where}</span>
              <span className="text-[15px] leading-[22px]">{item.text}</span>
              <span className="font-mono text-xs text-ink-muted">Matches: {item.matches}</span>
            </div>
          ))}
          <div className="py-3.5 font-mono text-xs text-ink-muted">+ 20 more</div>
        </div>
      </section>
    </div>
  )
}
