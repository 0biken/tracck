import { Check } from 'lucide-react'
import Link from 'next/link'
import { PageHeader, SectionHead } from '@/components/page-header'
import { ResumeRows } from '@/components/resumes/resume-rows'
import { StatGrid } from '@/components/stat-grid'
import { SystemCheck } from '@/components/system-check'
import { buttonClass } from '@/components/ui/button'
import { ACCOUNT, MOCK_USER } from '@/lib/mock/account'
import { RESUMES } from '@/lib/mock/resumes'

export const metadata = { title: 'Home' }

const sourceRows = [
  { name: 'GitHub', status: 'READY · 96 ENTRIES', ready: true },
  { name: 'CV (Tolu_CV_2026.pdf)', status: 'READY · 52 ENTRIES', ready: true },
  { name: 'LinkedIn export', status: 'COLLECTING · 214 / 380 ITEMS', ready: false },
]

export default function HomePage() {
  // The test job is a development tool, shown only when an API is configured.
  const apiUrl = process.env.NODE_ENV === 'production' ? undefined : process.env.NEXT_PUBLIC_API_URL

  return (
    <>
      <PageHeader
        eyebrow={`${ACCOUNT.today} · ${MOCK_USER.primaryRole}`}
        title="Home"
        actions={
          <Link href="/dashboard/resumes/new" className={buttonClass('primary', 'md')}>
            Paste a job description
          </Link>
        }
      />

      <div
        role="status"
        className="flex flex-wrap items-center justify-between gap-4 border border-signal bg-signal-tint px-5 py-4"
      >
        <div className="flex items-start gap-3">
          <Check className="mt-0.5 size-5 shrink-0 text-signal" strokeWidth={2} aria-hidden="true" />
          <div className="flex flex-col gap-0.5">
            <span className="font-bold text-signal">Your record is ready.</span>
            <span className="text-[15px] leading-[22px]">
              {ACCOUNT.entries} entries from GitHub and your CV. LinkedIn is still being read; Tracck will use it when it
              finishes.
            </span>
          </div>
        </div>
        <Link href="/dashboard/graph" className="inline-flex min-h-11 items-center text-sm font-semibold">
          Open the Career Graph
        </Link>
      </div>

      <StatGrid
        label="Your record at a glance"
        stats={[
          { label: 'Entries', value: ACCOUNT.entries, note: ACCOUNT.entriesDelta },
          { label: 'Sources ready', value: `${ACCOUNT.sourcesReady} / ${ACCOUNT.sourcesTotal}`, note: 'LinkedIn collecting' },
          { label: 'Resumes generated', value: ACCOUNT.resumes, note: `${ACCOUNT.resumesUsed} of ${ACCOUNT.resumesLimit} this month` },
          { label: 'Exported', value: ACCOUNT.exported, note: `Last ${ACCOUNT.lastExported}` },
        ]}
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-start gap-8">
        <section aria-labelledby="recent" className="flex min-w-0 flex-col gap-4">
          <SectionHead id="recent" title="Recent resumes" action={<Link href="/dashboard/resumes">All resumes</Link>} />
          <ResumeRows items={RESUMES.slice(0, 3)} compact />
        </section>

        <section aria-labelledby="sources" className="flex min-w-0 flex-col gap-4">
          <SectionHead id="sources" title="Sources" action={<Link href="/dashboard/sources">Manage</Link>} />
          <div className="border-t border-line">
            {sourceRows.map((row) => (
              <div key={row.name} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line py-3.5">
                <span className="font-semibold">{row.name}</span>
                <span className={`font-mono text-xs ${row.ready ? 'text-signal' : 'text-ink-muted'}`}>{row.status}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2 border border-line-strong bg-sunken p-4">
            <span className="font-bold">12 new entries since 2026.10.05</span>
            <span className="text-[15px] leading-[22px] text-ink-muted">
              New commits on lemni-billing and a release of consistent-hash-go. Your draft for Lagos Cloud Co could use
              them. Nothing is rewritten unless you ask.
            </span>
            <Link href="/dashboard/resumes/lagos-cloud-co/generating" className="inline-flex min-h-8 items-center text-sm font-semibold">
              Regenerate that draft
            </Link>
          </div>
        </section>
      </div>

      <section className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] items-center gap-6 border border-line p-6">
        <div className="flex flex-col gap-1.5">
          <div className="t-eyebrow text-ink-muted">CV feedback · Developer</div>
          <h2 className="t-claim m-0">Your uploaded CV has 4 weaknesses</h2>
          <span className="text-[15px] leading-[22px] text-ink-muted">
            Missing numbers on 5 bullets, 3 weak verbs, no projects section. Feedback only; nothing is rewritten.
          </span>
        </div>
        <div className="flex sm:justify-end">
          <Link href="/dashboard/feedback" className={buttonClass('secondary', 'md')}>
            Read the feedback
          </Link>
        </div>
      </section>

      {apiUrl && <SystemCheck apiUrl={apiUrl} />}
    </>
  )
}
