import { Check } from 'lucide-react'
import Link from 'next/link'
import { Meter } from '@/components/ui/meter'
import { Button, buttonClass } from '@/components/ui/button'
import { Eyebrow } from '@/components/page-header'
import { HeroShowcase } from '@/components/marketing/hero-showcase'
import { ProofBreakdown } from '@/components/marketing/proof-breakdown'

const wrap = 'mx-auto w-full max-w-[1200px] px-5 sm:px-8'

const steps = [
  {
    n: '01',
    title: 'Sync your proof of work',
    body: 'Connect your sources once. Tracck imports your work in the background with verified dates and links.',
  },
  {
    n: '02',
    title: 'Paste a job description',
    body: "Choose your target role and emphasis. Tracck selects matching projects and drafts verified bullet points.",
  },
  {
    n: '03',
    title: 'Review and export',
    body: 'Inspect the evidence behind every bullet, fine-tune wording, and export an ATS-safe PDF.',
  },
]

const problems = [
  ['Scattered wins across GitHub and CVs', 'Nobody compiles them, so resumes stay outdated'],
  ['One generic resume for every job', 'Misses role-specific keywords ATS filters demand'],
  ['Unfamiliar role conventions', 'Strong technical work hidden behind weak language'],
  ['Generic AI chatbots', 'Hallucinates experience that cannot be verified'],
]

const sources = [
  ['GitHub', 'CONNECT', 'Repositories, releases, and commits. Your richest source.'],
  ['CV or resume', 'UPLOAD', 'PDF or Word. Extracts verified experience with role feedback.'],
  ['Portfolio', 'PASTE LINK', 'Any public webpage or case study.'],
  ['LinkedIn', 'UPLOAD EXPORT', 'Data export ZIP, profile PDF, or pasted text.'],
  ['X', 'SOON', 'Connect or upload your archive.'],
  ['Behance and Figma', 'SOON', 'Project links and case studies.'],
  ['Manual work', 'FORM', 'Add unlisted projects directly with guided wording.'],
]

const differences = [
  ['Evidence on every bullet', 'Every bullet links to your source commit, repo, or document. Numbers are never invented.'],
  ['Actionable match report', 'Clear breakdown of covered skills, missing requirements, and suggested fixes.'],
  ['Six role profiles', 'Dedicated structures and vocabulary for Developers, DevRel, Designers, and Analysts.'],
  ['Verified drafting', 'Drafts are verified against job requirements and your proof of work.'],
  ['Layout-verified length', 'Strict one-page formatting checked against the rendered page, not estimated words.'],
  ['ATS-safe export', 'Clean standard headings and bullets. PDF now, DOCX on Pro.'],
]

export default function LandingPage() {
  return (
    <main>
      {/* Hero */}
      <section className={`${wrap} flex flex-col items-center text-center gap-10 pb-16 pt-14 sm:pt-20`}>
        <div className="flex flex-col items-center gap-6 max-w-3xl">
          <h1 className="t-display m-0 text-balance">Your wins. Always ready.</h1>
          <p className="m-0 max-w-xl text-xl leading-[31px] text-ink-muted">
            Connect your sources once. Paste a job description to get a tailored ATS resume backed by verified proof.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button href="/signup" variant="primary" size="xl">
              Build your proof of work
            </Button>
            <Button href="/#how" variant="secondary" size="xl">
              See how it works
            </Button>
          </div>
        </div>

        {/* 3D GridScan Hero Showcase */}
        <HeroShowcase />
      </section>

      {/* Interactive Proof Breakdown */}
      <ProofBreakdown />

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
              Builders ship real projects, but packaging wins into hiring language for every role takes time.
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
            Tracck connects directly to public work. No scraping or session snooping.
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
          <Button href="/pricing" variant="secondary" size="xl">
            See pricing
          </Button>
        </div>
      </section>
    </main>
  )
}
