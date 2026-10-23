'use client'

import { Check } from 'lucide-react'
import Link from 'next/link'
import type { SourceView } from '@tracck/shared'
import { useSources } from '@/components/sources/use-sources'
import { Button, buttonClass } from '@/components/ui/button'
import { Meter } from '@/components/ui/meter'
import { api, messageOf } from '@/lib/api/client'
import { formatCount } from '@/lib/format'
import { useState } from 'react'

const rowBase =
  'grid grid-cols-1 items-center gap-2 border-b border-line py-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] sm:gap-6 sm:py-[22px]'

function detailOf(source: SourceView) {
  if (source.state === 'ready') return `${formatCount(source.entries)} ${source.entries === 1 ? 'ENTRY' : 'ENTRIES'} KEPT`
  if (source.state === 'collecting') {
    const entries = source.entries > 0 ? ` · ${formatCount(source.entries)} ENTRIES SO FAR` : ''
    return source.progress ? `READING · ${source.progress.done}%${entries}` : `QUEUED${entries}`
  }
  return source.problem ?? 'SOMETHING WENT WRONG'
}

/** Live progress of each source being read. The person can leave: it carries on without them. */
export function CollectionStatus({ initial, email }: { initial: SourceView[]; email: string }) {
  const { sources, reload } = useSources(initial)
  const [retrying, setRetrying] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const anyReady = sources.some((source) => source.state === 'ready')

  async function retry(id: string) {
    setRetrying(id)
    setError(null)
    try {
      await api.sources.retry(id)
      await reload()
    } catch (failure) {
      setError(messageOf(failure))
    } finally {
      setRetrying(null)
    }
  }

  return (
    <>
      <p className="m-0 text-lg leading-7 text-ink-muted">
        You don&apos;t have to wait here. We&apos;ll email {email || 'you'} when your first source is ready. You can generate
        as soon as one source finishes.
      </p>

      {error && (
        <div role="alert" className="border border-danger bg-danger-tint px-4 py-3 text-sm text-danger-ink">
          {error}
        </div>
      )}

      <section role="status" aria-live="polite" aria-label="Collection progress">
        <div
          className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] gap-6 border-b-2 border-ink pb-3 text-xs font-bold tracking-[0.08em] sm:grid"
          aria-hidden="true"
        >
          <span>SOURCE</span>
          <span>PROGRESS</span>
          <span>STATUS</span>
        </div>

        {sources.length === 0 && (
          <p className="m-0 border-b border-line py-6 text-[15px] text-ink-muted">
            No sources yet. <Link href="/onboarding/sources">Add one</Link> to start your record.
          </p>
        )}

        {sources.map((source) => {
          if (source.state === 'problem') {
            return (
              <div key={source.id} className={`${rowBase} border-danger bg-danger-tint px-4`}>
                <span className="text-[17px] font-bold">{source.name}</span>
                <span className="text-sm leading-[21px]">{detailOf(source)}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[13px] text-danger-ink">PROBLEM</span>
                  <Button variant="secondary" size="sm" loading={retrying === source.id} onClick={() => retry(source.id)}>
                    Retry
                  </Button>
                </div>
              </div>
            )
          }
          const ready = source.state === 'ready'
          return (
            <div key={source.id} className={`${rowBase} ${ready ? 'border-signal bg-signal-tint px-4' : ''}`}>
              <span className="text-[17px] font-bold">{source.name}</span>
              <div className="flex flex-col gap-1.5">
                <Meter
                  value={ready ? 100 : (source.progress?.done ?? 0)}
                  tone={ready ? 'signal' : 'ink'}
                  label={`${source.name} progress`}
                  className={ready ? '!bg-signal/25' : ''}
                />
                <span className={`font-mono text-xs ${ready ? '' : 'text-ink-muted'}`}>{detailOf(source)}</span>
              </div>
              <span className={`font-mono text-[13px] ${ready ? 'text-signal' : ''}`}>{ready ? 'READY' : 'COLLECTING'}</span>
            </div>
          )
        })}
      </section>

      {anyReady && (
        <div className="flex items-start gap-3 border border-signal bg-signal-tint px-5 py-4">
          <Check className="mt-0.5 size-5 shrink-0 text-signal" strokeWidth={2} aria-hidden="true" />
          <span className="text-[15px] leading-[22px]">
            <strong className="text-signal">Your record is ready.</strong> A source finished. Paste a job description now;
            Tracck will use the other sources when they finish.
          </span>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Link
          href="/dashboard/resumes/new"
          aria-disabled={!anyReady}
          className={`${buttonClass('primary', 'lg')} ${anyReady ? '' : 'pointer-events-none opacity-50'}`}
        >
          Paste a job description
        </Link>
        <Link href="/dashboard" className={buttonClass('secondary', 'lg')}>
          Go to home
        </Link>
      </div>
    </>
  )
}
