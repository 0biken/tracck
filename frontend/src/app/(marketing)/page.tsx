import { Check } from 'lucide-react'
import Link from 'next/link'
import { Meter } from '@/components/ui/meter'
import { buttonClass } from '@/components/ui/button'
import { Eyebrow } from '@/components/page-header'
import { HeroShowcase } from '@/components/marketing/hero-showcase'

const wrap = 'mx-auto w-full max-w-[1200px] px-5 sm:px-8'

const steps = [
  {
    n: '01',
    title: 'Build your Career Graph',
    body: 'Connect your sources once. Tracck imports your full history in the background, cuts out noise, and organizes every accomplishment with dates and links. No loading screens to wait on.',
  },
  {
    n: '02',
    title: 'Paste a job, get a tailored resume',
    body: "Choose one page or full and choose what to emphasize. Tracck selects your most relevant projects, drafts in your role's language, and verifies every bullet point.",
  },
  {
    n: '03',
    title: 'Review, then export',
    body: 'Open the draft next to its match report. See the evidence behind each bullet, edit anything, and export an ATS-safe PDF when you are ready.',
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
  ['CV or resume', 'UPLOAD', 'PDF or Word. Added to your proof of work, with feedback for your role.'],
  ['Portfolio', 'PASTE LINK', 'Any public page you want included.'],
  ['LinkedIn', 'UPLOAD EXPORT', 'Your data export ZIP, profile PDF or pasted text.'],
  ['X', 'SOON', 'Connect or upload your archive, subject to access.'],
  ['Behance and Figma', 'SOON', 'Paste project links for case studies.'],
  ['Manual work', 'FORM', 'For work with no public trace. Tracck helps polish the wording.'],
]

const differences = [
  ['Evidence on every bullet', 'Open any line to see the source, date and original project. If a bullet needs a number you never stated, it is flagged "Confirm a number", never invented.'],
  ['Match report with reasons', 'Which requirements you cover, which are missing from your evidence, and what you could add. Never a bare number.'],
  ['Six role profiles', 'Developer, Dev Rel and Community, Social Media Manager, Virtual Assistant, UI/UX Designer, Data Analyst. Each with its own section order, verbs and scoring.'],
  ['Write, check, improve', 'Tracck reviews against the job description and your role, fixes specific gaps, and verifies the bullet points.'],
  ['One page or full', 'Length is checked on the finished layout, not guessed from a word count. Full never pads.'],
  ['ATS-safe export', 'No tables, columns or text boxes. Standard headings and bullets. PDF now, DOCX on Pro.'],
]

export default function LandingPage() {
  return (
    <main>
      {/* Hero */}
      <section className={`${wrap} flex flex-col items-center text-center gap-10 pb-16 pt-14 sm:pt-20`}>
        <div className="flex flex-col items-center gap-6 max-w-3xl">
          <Eyebrow>
            <span className="text-signal">Proof-first</span> · Resume engine for Nigerian tech talent
          </Eyebrow>
          <h1 className="t-display m-0 text-balance">Your wins. Always ready.</h1>
          <p className="m-0 max-w-xl text-xl leading-[31px] text-ink-muted">
            Connect GitHub, your old CV and your portfolio once. Paste a job description and Tracck writes a tailored
            resume where every line traces back to verified work you shipped.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/signup" className={buttonClass('primary', 'xl')}>
              Build your proof of work
            </Link>
            <Link href="/#how" className={buttonClass('secondary', 'xl')}>
              See how it works
            </Link>
          </div>
        </div>

        {/* 3D GridScan Hero Showcase */}
        <HeroShowcase />
      </section>

      {/* Proof strip */}
      <section className="border-y border-line bg-sunken" aria-label="What Tracck guarantees">
        <div className={`${wrap} flex flex-wrap justify-between gap-x-10 gap-y-3 py-5 font-mono text-[13px]`}>
          <span>100% OF BULLETS TRACED TO EVIDENCE</span>
          <span>0 INVENTED METRICS</span>
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
            <h2 className="t-h2 m-0 text-balance">Written for your role. Verified against your proof of work.</h2>
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

      {/* Closing call */}
      <section className={`${wrap} flex flex-col items-start gap-6 py-20 sm:py-24`}>
        <h2 className="t-h1 m-0 max-w-200 text-balance">Your next application deserves its own resume.</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/signup" className={buttonClass('primary', 'xl')}>
            Build your proof of work
          </Link>
          <Link href="/pricing" className={buttonClass('secondary', 'xl')}>
            See pricing
          </Link>
        </div>
      </section>
    </main>
  )
}
