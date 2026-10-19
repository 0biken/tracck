import { Check } from 'lucide-react'
import Link from 'next/link'
import { Meter } from '@/components/ui/meter'
import { buttonClass } from '@/components/ui/button'
import { Eyebrow } from '@/components/page-header'

const wrap = 'mx-auto w-full max-w-[1200px] px-5 sm:px-8'

const steps = [
  {
    n: '01',
    title: 'Build your Career Graph',
    body: 'Connect your sources once. Tracck collects your full history in the background, removes noise and keeps every accomplishment as a dated, linked entry. You never wait on a loading screen.',
  },
  {
    n: '02',
    title: 'Paste a job, get a resume',
    body: "Choose one page or full and say what to emphasise. Tracck finds your most relevant evidence, writes in your role's language, checks its own draft and improves it.",
  },
  {
    n: '03',
    title: 'Review, then export',
    body: 'Open the draft next to its match report. See the evidence behind each bullet, edit anything, and export an ATS-safe PDF only when you are happy with it.',
  },
]

const problems = [
  ['Wins are scattered across GitHub, X, LinkedIn and old CVs', 'Nobody compiles them, so the resume is out of date'],
  ['One generic resume goes to every job', 'It misses the keywords each job asks for'],
  ['Role conventions are unknown', 'Strong work in weak, unscannable language'],
  ['Generic AI tools write from a prompt', 'Fiction that cannot be traced to anything real'],
]

const sources = [
  ['GitHub', 'CONNECT', 'Repositories, releases and code activity. Your richest source.'],
  ['CV or resume', 'UPLOAD', 'PDF or Word. Added to your record, with feedback for your role.'],
  ['Portfolio', 'PASTE LINK', 'Any public page you want included.'],
  ['LinkedIn', 'UPLOAD EXPORT', 'Your data export ZIP, profile PDF or pasted text.'],
  ['X', 'SOON', 'Connect or upload your archive, subject to access.'],
  ['Behance and Figma', 'SOON', 'Paste project links for case studies.'],
  ['Manual entry', 'FORM', 'For work with no public trace. Tracck helps with the wording.'],
]

const differences = [
  ['Evidence on every bullet', 'Open any line to see the source, date and original text. If a bullet needs a number you never stated, it is flagged "Confirm a number", never invented.'],
  ['Match report with reasons', 'Which requirements you cover, which are missing from your evidence, and what you could add. Never a bare number.'],
  ['Six role profiles', 'Developer, Dev Rel and Community, Social Media Manager, Virtual Assistant, UI/UX Designer, Data Analyst. Each with its own section order, verbs and scoring.'],
  ['Write, check, improve', 'Tracck does not accept its first draft. It reviews against the job and your role, fixes specific problems and reviews again.'],
  ['One page or full', 'Length is checked on the finished layout, not guessed from a word count. Full never pads.'],
  ['ATS-safe export', 'No tables, columns or text boxes. Standard headings and bullets. PDF now, DOCX on Pro.'],
]

export default function LandingPage() {
  return (
    <main>
      {/* Hero */}
      <section className={`${wrap} grid grid-cols-[repeat(auto-fit,minmax(min(100%,460px),1fr))] items-center gap-14 pb-16 pt-14 sm:pt-20`}>
        <div className="flex flex-col gap-6">
          <Eyebrow>
            <span className="text-signal">Entry 001</span> — Resume engine for Nigerian tech talent
          </Eyebrow>
          <h1 className="t-display m-0 text-balance">Your wins. Always ready.</h1>
          <p className="m-0 max-w-130 text-xl leading-[31px]">
            Connect GitHub, your old CV and your portfolio once. Paste a job description and Tracck writes a tailored
            resume where every line traces back to something you actually did.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/signup" className={buttonClass('primary', 'xl')}>
              Build your record
            </Link>
            <Link href="/#how" className={buttonClass('secondary', 'xl')}>
              See how it works
            </Link>
          </div>
          <div className="font-mono text-[13px] text-ink-muted">Free: 1 source, 2 resumes a month. No card.</div>
        </div>

        <div
          aria-label="Product preview"
          className="grid grid-cols-1 border border-line-strong bg-sunken md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]"
        >
          <div className="flex flex-col gap-3.5 border-b border-line bg-canvas p-6 md:border-b-0 md:border-r">
            <Eyebrow>Resume for Kora Payments</Eyebrow>
            <div className="font-display text-[22px] font-bold leading-7">Tolu Adebayo</div>
            <div className="font-mono text-xs text-ink-muted">Backend Engineer · Ibadan · github.com/toluadebayo</div>
            <div className="h-0.5 bg-ink" />
            <div className="text-[11px] font-bold tracking-[0.08em]">PROJECTS</div>
            <div className="flex flex-col gap-2 border border-signal bg-signal-tint p-3">
              <div className="text-sm leading-[21px]">
                Built a NestJS subscription billing service handling card retries with BullMQ queues and Postgres.
              </div>
              <div className="flex items-center gap-1.5 font-mono text-[11px] text-signal">
                <Check className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
                GITHUB — lemni-billing — 2026.08.18
              </div>
            </div>
            <div className="text-sm leading-[21px] text-ink-muted">
              Designed consistent hashing ring in Go for cache sharding across nodes.
            </div>
            <div className="text-sm leading-[21px] text-ink-muted">
              Led NACOS UI monthly sessions on system design for 120 members.
            </div>
            <div className="h-2.5 w-4/5 bg-sunken-2" />
            <div className="h-2.5 w-2/3 bg-sunken-2" />
          </div>
          <div className="flex flex-col gap-4 p-6">
            <Eyebrow>Match report</Eyebrow>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[44px] font-medium tracking-[-0.02em]">82</span>
              <span className="font-mono text-[13px] text-ink-muted">/ 100 · Developer</span>
            </div>
            <div className="flex flex-col gap-2.5 text-[13px] leading-[18px]">
              <div className="flex justify-between gap-2">
                <span>Required skills covered</span>
                <span className="font-mono">7 / 8</span>
              </div>
              <Meter value={87} label="Required skills covered, 7 of 8" />
              <div className="flex justify-between gap-2">
                <span>Claims traced to evidence</span>
                <span className="font-mono text-signal">100%</span>
              </div>
              <Meter value={100} tone="signal" label="Claims traced to evidence, 100%" />
              <div className="flex justify-between gap-2">
                <span>Measurable outcomes</span>
                <span className="font-mono">3 / 6</span>
              </div>
              <Meter value={50} label="Measurable outcomes, 3 of 6" />
            </div>
            <div className="flex flex-col gap-1.5 border-t border-line pt-3">
              <div className="text-xs font-bold tracking-[0.08em]">MISSING FROM YOUR EVIDENCE</div>
              <div className="text-[13px] leading-[18px] text-danger-ink">Kubernetes. Tracck will not claim it.</div>
            </div>
          </div>
        </div>
      </section>

      {/* Proof strip */}
      <section className="border-y border-line bg-sunken" aria-label="What Tracck guarantees">
        <div className={`${wrap} flex flex-wrap justify-between gap-x-10 gap-y-3 py-5 font-mono text-[13px]`}>
          <span>100% OF CLAIMS TRACED TO EVIDENCE</span>
          <span>0 INVENTED NUMBERS</span>
          <span>6 ROLE PROFILES</span>
          <span>ONE PAGE OR FULL</span>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className={`${wrap} flex scroll-mt-4 flex-col gap-12 py-20 sm:py-24`}>
        <div className="flex max-w-180 flex-col gap-4">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="t-h1 m-0 text-balance">Two steps. You keep the pen.</h2>
        </div>
        <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] border-t-2 border-ink p-0">
          {steps.map((step) => (
            <li key={step.n} className="flex flex-col gap-3.5 border-b border-line py-8 md:border-b-0 md:border-r md:px-8 md:first:pl-0 md:last:border-r-0 md:last:pr-0">
              <div className="font-mono text-[13px] text-signal">{step.n}</div>
              <h3 className="t-h3 m-0">{step.title}</h3>
              <p className="m-0 text-[17px] leading-[27px] text-ink-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* The problem */}
      <section className="border-y border-line bg-sunken">
        <div className={`${wrap} grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] gap-14 py-20 sm:py-24`}>
          <div className="flex flex-col gap-4">
            <Eyebrow>The problem</Eyebrow>
            <h2 className="t-h2 m-0 text-balance">The work exists. The resume does not show it.</h2>
            <p className="m-0 text-lg leading-7 text-ink-muted">
              Students, NYSC corpers and self-taught builders ship real work in public. Writing it down is a separate
              skill, and every job wants different emphasis.
            </p>
          </div>
          <div className="border-t-2 border-ink">
            <div className="grid grid-cols-2 gap-6 border-b border-line-strong py-3 text-xs font-bold tracking-[0.08em]">
              <span>THE REALITY</span>
              <span>THE COST</span>
            </div>
            {problems.map(([reality, cost]) => (
              <div key={reality} className="grid grid-cols-2 gap-6 border-b border-line py-4 text-base leading-6">
                <span>{reality}</span>
                <span className="text-ink-muted">{cost}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sources */}
      <section id="sources" className={`${wrap} flex scroll-mt-4 flex-col gap-10 py-20 sm:py-24`}>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex max-w-160 flex-col gap-4">
            <Eyebrow>Sources</Eyebrow>
            <h2 className="t-h2 m-0 text-balance">Bring the work you already did.</h2>
          </div>
          <p className="m-0 max-w-105 text-base leading-6 text-ink-muted">
            Every route is started by you. Tracck never scrapes a platform or reads your logged-in sessions.
          </p>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-px border border-line bg-line">
          {sources.map(([name, tag, body]) => (
            <div key={name} className="flex flex-col gap-2 bg-canvas p-6">
              <div className="flex justify-between gap-2">
                <span className="text-[17px] font-bold">{name}</span>
                <span className="font-mono text-xs text-ink-muted">{tag}</span>
              </div>
              <span className="text-[15px] leading-[22px] text-ink-muted">{body}</span>
            </div>
          ))}
          <div className="flex flex-col gap-2 bg-sunken p-6">
            <span className="text-[17px] font-bold">Never scraped</span>
            <span className="text-[15px] leading-[22px] text-ink-muted">
              No third-party data providers. No browser automation.
            </span>
          </div>
        </div>
      </section>

      {/* What makes it different */}
      <section className="border-t border-line">
        <div className={`${wrap} flex flex-col gap-10 py-20 sm:py-24`}>
          <div className="flex max-w-180 flex-col gap-4">
            <Eyebrow>What makes it different</Eyebrow>
            <h2 className="t-h2 m-0 text-balance">Written for your role. Checked against your record.</h2>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-8">
            {differences.map(([title, body]) => (
              <div
                key={title}
                id={title === 'Six role profiles' ? 'roles' : undefined}
                className="flex scroll-mt-6 flex-col gap-2.5 border-t-2 border-ink pt-5"
              >
                <h3 className="t-claim m-0">{title}</h3>
                <p className="m-0 text-base leading-[25px] text-ink-muted">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Organisations */}
      <section id="orgs" className="scroll-mt-4 bg-inverse text-on-inverse">
        <div className={`${wrap} grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-center gap-14 py-20 sm:py-24`}>
          <div className="flex flex-col gap-5">
            <Eyebrow className="!text-inverse-muted">For universities, bootcamps and job platforms</Eyebrow>
            <h2 className="t-h1 m-0 text-balance">Verified resumes through one API.</h2>
            <p className="m-0 text-lg leading-7 text-inverse-muted">
              Each organisation gets its own scoped keys, limits and usage dashboard. You read a person&apos;s data only
              after they consent.
            </p>
            <div>
              <Link href="/waitlist" className={buttonClass('inverse', 'md')}>
                Join the API waitlist
              </Link>
            </div>
          </div>
          <pre className="m-0 overflow-x-auto border border-inverse-line p-6 font-mono text-sm leading-6" aria-label="Example API request">
            <span className="text-inverse-muted">POST /v1/resumes{'\n'}Authorization: Bearer trk_live_8f2a••••••••</span>
            {'\n\n{ "user": "usr_31c9", "length": "one_page",\n  "job_description": "Backend Engineer..." }\n\n'}
            <span className="text-signal-on-inverse">201 Created · consent: granted 2026.10.02</span>
          </pre>
        </div>
      </section>

      {/* Closing call */}
      <section className={`${wrap} flex flex-col items-start gap-6 py-20 sm:py-24`}>
        <h2 className="t-h1 m-0 max-w-200 text-balance">Your next application deserves its own resume.</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/signup" className={buttonClass('primary', 'xl')}>
            Build your record
          </Link>
          <Link href="/pricing" className={buttonClass('secondary', 'xl')}>
            See pricing
          </Link>
        </div>
      </section>
    </main>
  )
}
