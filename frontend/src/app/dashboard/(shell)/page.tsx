import { Check } from 'lucide-react'
import Link from 'next/link'
import type { SourceView } from '@tracck/shared'
import { PageHeader, SectionHead } from '@/components/page-header'
import { ResumeRows } from '@/components/resumes/resume-rows'
import { StatGrid } from '@/components/stat-grid'
import { SystemCheck } from '@/components/system-check'
import { Button, buttonClass } from '@/components/ui/button'
import { serverApi } from '@/lib/api/server'
import { formatCount, formatDate } from '@/lib/format'
import { roleName } from '@/lib/resumes'

export const metadata = { title: 'Home' }

const statusOf = (source: SourceView) =>
  source.state === 'ready'
    ? `READY · ${formatCount(source.entries)} ${source.entries === 1 ? 'PROJECT' : 'PROJECTS'}`
    : source.state === 'collecting'
      ? source.progress?.total
        ? `SYNCING · ${source.progress.done} / ${source.progress.total} ITEMS`
        : 'SYNCING'
      : 'PROBLEM'

export default async function HomePage() {
  const api = serverApi()
  const [me, summary, sources, resumes] = await Promise.all([
    api.me.get(),
    api.me.summary(),
    api.sources.list(),
    api.resumes.list({ limit: 3 }),
  ])

  // The test job is a development tool, shown only when an API is configured.
  const apiUrl = process.env.NODE_ENV === 'production' ? undefined : process.env.NEXT_PUBLIC_API_URL
  const stale = resumes.items.find((resume) => resume.newEntries > 0 && resume.status !== 'generating')
  const collecting = sources.filter((source) => source.state === 'collecting')
  const hasCv = sources.some((source) => source.provider === 'cv')

  return (
    <>
      <PageHeader
        eyebrow={[formatDate(new Date().toISOString()), roleName(me.primaryRole)].filter(Boolean).join(' · ')}
        title="Home"
        actions={
          <Link href="/dashboard/resumes/new" className={buttonClass('primary', 'md')}>
            Tailor for a job
          </Link>
        }
      />

      {summary.sourcesReady > 0 ? (
        <div role="status" className="flex flex-wrap items-center justify-between gap-4 border border-signal bg-signal-tint px-5 py-4">
          <div className="flex items-start gap-3">
            <Check className="mt-0.5 size-5 shrink-0 text-signal" strokeWidth={2} aria-hidden="true" />
            <div className="flex flex-col gap-0.5">
              <span className="font-bold text-signal">Your proof of work is ready.</span>
              <span className="text-[15px] leading-[22px]">
                {formatCount(summary.entries)} {summary.entries === 1 ? 'project' : 'projects'} synced from {summary.sourcesReady} {summary.sourcesReady === 1 ? 'source' : 'sources'}.
                {collecting.length > 0 &&
                  ` ${collecting.map((source) => source.name).join(' and ')} ${collecting.length === 1 ? 'is' : 'are'} still syncing; Tracck will include ${collecting.length === 1 ? 'it' : 'them'} when ready.`}
              </span>
            </div>
          </div>
          <Link href="/dashboard/graph" className="inline-flex min-h-11 items-center text-sm font-semibold">
            Open the Career Graph
          </Link>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4 border border-line-strong bg-sunken px-5 py-4">
          <div className="flex flex-col gap-0.5">
            <span className="font-bold">{collecting.length > 0 ? 'Your sources are syncing.' : 'Start your proof of work.'}</span>
            <span className="text-[15px] leading-[22px] text-ink-muted">
              {collecting.length > 0
                ? 'This runs in the background. You can generate as soon as one source is ready.'
                : 'Connect GitHub, upload a CV or add what you have done. Resumes are tailored from this verified work.'}
            </span>
          </div>
          <Button href="/dashboard/sources" variant="secondary" size="md">
            {collecting.length > 0 ? 'See progress' : 'Connect a source'}
          </Button>
        </div>
      )}

      <StatGrid
        label="Your work at a glance"
        stats={[
          {
            label: 'Projects',
            value: formatCount(summary.entries),
            note: summary.entriesSince ? `+${summary.entriesSince.count} since ${formatDate(summary.entriesSince.date)}` : 'Nothing new this week',
          },
          { label: 'Sources ready', value: `${summary.sourcesReady} / ${summary.sourcesTotal}`, note: collecting.length ? `${collecting.length} syncing` : 'All synced' },
          {
            label: 'Resumes generated',
            value: summary.resumes,
            note: `${summary.resumesThisMonth}${summary.resumesLimit !== null ? ` of ${summary.resumesLimit}` : ''} this month`,
          },
          { label: 'Exported', value: summary.exported, note: summary.lastExportedAt ? `Last ${formatDate(summary.lastExportedAt)}` : 'None yet' },
        ]}
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-start gap-8">
        <section aria-labelledby="recent" className="flex min-w-0 flex-col gap-4">
          <SectionHead id="recent" title="Recent resumes" action={<Link href="/dashboard/resumes">All resumes</Link>} />
          {resumes.items.length > 0 ? (
            <ResumeRows items={resumes.items} compact />
          ) : (
            <p className="m-0 border border-line p-6 text-[15px] text-ink-muted">
              No resumes yet. <Link href="/dashboard/resumes/new">Tailor for a job</Link> to write your first.
            </p>
          )}
        </section>

        <section aria-labelledby="sources" className="flex min-w-0 flex-col gap-4">
          <SectionHead id="sources" title="Sources" action={<Link href="/dashboard/sources">Manage</Link>} />
          <div className="border-t border-line">
            {sources.length === 0 && <p className="m-0 border-b border-line py-3.5 text-[15px] text-ink-muted">Nothing connected yet.</p>}
            {sources.map((source) => (
              <div key={source.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line py-3.5">
                <span className="font-semibold">{source.detail && source.provider === 'cv' ? `${source.name} (${source.detail})` : source.name}</span>
                <span className={`font-mono text-xs ${source.state === 'ready' ? 'text-signal' : source.state === 'problem' ? 'text-danger-ink' : 'text-ink-muted'}`}>
                  {statusOf(source)}
                </span>
              </div>
            ))}
          </div>
          {summary.entriesSince && stale && (
            <div className="flex flex-col gap-2 border border-line-strong bg-sunken p-4">
              <span className="font-bold">
                {summary.entriesSince.count} new {summary.entriesSince.count === 1 ? 'project' : 'projects'} since {formatDate(summary.entriesSince.date)}
              </span>
              <span className="text-[15px] leading-[22px] text-ink-muted">
                Your draft for {stale.company || stale.title} can include {stale.newEntries === 1 ? 'it' : 'them'}.
              </span>
              <Link href={`/dashboard/resumes/${stale.id}`} className="inline-flex min-h-8 items-center text-sm font-semibold">
                Open that draft
              </Link>
            </div>
          )}
        </section>
      </div>

      {(summary.cvWeaknesses !== null || hasCv) && (
        <section className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] items-center gap-6 border border-line p-6">
          <div className="flex flex-col gap-1.5">
            <div className="t-eyebrow text-ink-muted">CV feedback{roleName(me.primaryRole) && ` · ${roleName(me.primaryRole)}`}</div>
            <h2 className="t-claim m-0">
              {summary.cvWeaknesses === null
                ? 'Get feedback on your uploaded CV'
                : summary.cvWeaknesses === 0
                  ? 'No high-impact fixes needed for this CV'
                  : `Your uploaded CV has ${summary.cvWeaknesses} suggested ${summary.cvWeaknesses === 1 ? 'fix' : 'fixes'}`}
            </h2>
            <span className="text-[15px] leading-[22px] text-ink-muted">Suggested fixes to strengthen your bullet points.</span>
          </div>
          <div className="flex sm:justify-end">
            <Button href="/dashboard/feedback" variant="secondary" size="md">
              {summary.cvWeaknesses === null ? 'Review my CV' : 'Read suggested fixes'}
            </Button>
          </div>
        </section>
      )}

      {apiUrl && <SystemCheck apiUrl={apiUrl} />}
    </>
  )
}
