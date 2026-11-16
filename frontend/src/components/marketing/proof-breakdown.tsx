'use client'

import { useState } from 'react'
import { Check, GitCommit, ArrowRight, ShieldCheck, FileText, Layers } from 'lucide-react'
import { Eyebrow } from '@/components/page-header'

interface ProofSample {
  id: string
  role: string
  title: string
  sourceType: string
  sourceRef: string
  commitHash: string
  date: string
  rawCommit: string
  verifiedArtifacts: string[]
  tailoredFor: string
  resumeBullet: string
  matchedSkills: string[]
}

const PROOF_SAMPLES: ProofSample[] = [
  {
    id: 'backend',
    role: 'Backend Engineer',
    title: 'Billing service',
    sourceType: 'GITHUB REPOSITORY',
    sourceRef: 'lemni / billing-service',
    commitHash: '8f2a1c9',
    date: '2026.08.18',
    rawCommit: 'feat: add BullMQ worker queues for failed card payment retries and Postgres reconciliation',
    verifiedArtifacts: ['BullMQ', 'PostgreSQL', 'NestJS', '99.8% recovery'],
    tailoredFor: 'Fintech Backend Engineer',
    resumeBullet: 'Architected automated card retry workers with NestJS, BullMQ, and PostgreSQL, recovering 99.8% of failed recurring charges across 45k monthly transactions.',
    matchedSkills: ['NestJS', 'BullMQ', 'PostgreSQL', 'Payment retries'],
  },
  {
    id: 'frontend',
    role: 'Product Designer',
    title: 'Mobile checkout',
    sourceType: 'FIGMA & PORTFOLIO',
    sourceRef: 'framer.me / adebayo / checkout-v2',
    commitHash: 'v2.4.0',
    date: '2026.09.04',
    rawCommit: 'Case study: redesigned 3-step checkout with instant bank transfer verification and reduced drop-off',
    verifiedArtifacts: ['Figma tokens', 'User testing (N=24)', '18% drop-off reduction'],
    tailoredFor: 'UI/UX Product Designer',
    resumeBullet: 'Redesigned mobile checkout flow from usability studies with 24 Nigerian users, reducing step drop-off by 18% across bank transfer payment methods.',
    matchedSkills: ['Usability testing', 'Figma', 'Checkout UX', 'Conversion'],
  },
  {
    id: 'data',
    role: 'Data Analyst',
    title: 'Churn model',
    sourceType: 'GITHUB & JUPYTER',
    sourceRef: 'tolu-ade / subscriber-retention',
    commitHash: 'd4b7021',
    date: '2026.07.12',
    rawCommit: 'analysis: cohort churn analysis on 120k customer rows with pandas and logistic regression',
    verifiedArtifacts: ['Python', 'Pandas', 'SQL queries', 'AUC 0.84'],
    tailoredFor: 'Growth Data Analyst',
    resumeBullet: 'Analyzed 120,000 subscriber cohorts in Python and PostgreSQL to isolate churn triggers, delivering predictive risk flags with 0.84 AUC for proactive outreach.',
    matchedSkills: ['Python', 'PostgreSQL', 'Cohort analysis', 'Retention'],
  },
]

export function ProofBreakdown() {
  const [activeId, setActiveId] = useState(PROOF_SAMPLES[0].id)
  const active = PROOF_SAMPLES.find((item) => item.id === activeId) ?? PROOF_SAMPLES[0]

  return (
    <section className="border-y border-line bg-sunken py-12 sm:py-16" aria-labelledby="proof-breakdown-heading">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-5 sm:px-8">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-2">
            <Eyebrow>Proof in action</Eyebrow>
            <h2 id="proof-breakdown-heading" className="t-h2 m-0 text-balance">
              Every bullet traces to work you actually shipped.
            </h2>
          </div>
          <p className="m-0 max-w-md text-[15px] leading-6 text-ink-muted">
            See how raw commits, codebases, and case studies turn into verified, ATS-tailored resume bullets.
          </p>
        </div>

        {/* Role tabs */}
        <div className="flex flex-wrap gap-2 border-b border-line pb-4" role="tablist" aria-label="Proof examples by role">
          {PROOF_SAMPLES.map((sample) => {
            const isSelected = sample.id === activeId
            return (
              <button
                key={sample.id}
                role="tab"
                type="button"
                aria-selected={isSelected}
                onClick={() => setActiveId(sample.id)}
                className={`inline-flex items-center gap-2 rounded-md border px-3.5 py-2 text-sm font-semibold transition-colors ${
                  isSelected
                    ? 'border-line-strong bg-canvas text-ink shadow-xs'
                    : 'border-transparent text-ink-muted hover:border-line hover:text-ink'
                }`}
              >
                <span>{sample.role}</span>
                <span className="font-mono text-xs text-ink-muted opacity-75">({sample.title})</span>
              </button>
            )
          })}
        </div>

        {/* Interactive side-by-side card */}
        <div className="grid grid-cols-1 items-stretch gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-[1fr_auto_1.2fr]">
          {/* Source proof pane */}
          <div className="flex flex-col justify-between gap-5 bg-canvas p-6 sm:p-7">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold tracking-wider text-signal">
                  <ShieldCheck className="size-4 shrink-0" strokeWidth={2.2} />
                  {active.sourceType}
                </span>
                <span className="font-mono text-xs text-ink-muted">{active.date}</span>
              </div>

              <div className="font-mono text-sm font-bold text-ink">{active.sourceRef}</div>

              <div className="flex flex-col gap-1.5 rounded-md border border-line bg-sunken p-3.5">
                <div className="flex items-center gap-1.5 font-mono text-xs text-ink-muted">
                  <GitCommit className="size-3.5 shrink-0" strokeWidth={2} />
                  <span>commit {active.commitHash}</span>
                </div>
                <p className="m-0 font-mono text-xs leading-5 text-ink">{active.rawCommit}</p>
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-line pt-4">
              <span className="text-xs font-bold tracking-wider text-ink-muted">EXTRACTED EVIDENCE</span>
              <div className="flex flex-wrap gap-1.5">
                {active.verifiedArtifacts.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-1 rounded bg-sunken px-2 py-1 font-mono text-xs text-ink"
                  >
                    <Check className="size-3 text-signal" strokeWidth={2.5} />
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Transformation connector */}
          <div className="hidden items-center justify-center bg-sunken px-4 py-6 lg:flex">
            <div className="flex size-10 items-center justify-center rounded-full border border-line bg-canvas text-signal shadow-xs">
              <ArrowRight className="size-4" strokeWidth={2.5} />
            </div>
          </div>

          {/* Tailored resume bullet pane */}
          <div className="flex flex-col justify-between gap-5 bg-canvas p-6 sm:p-7">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold tracking-wider text-ink-muted">
                  <FileText className="size-4 shrink-0 text-ink" strokeWidth={2} />
                  RESUME BULLET
                </span>
                <span className="rounded bg-signal-tint px-2 py-0.5 font-mono text-xs font-bold text-signal">
                  ATS VERIFIED
                </span>
              </div>

              <div className="text-xs text-ink-muted">
                Targeting: <strong className="text-ink">{active.tailoredFor}</strong>
              </div>

              <div className="rounded-md border border-signal/40 bg-signal-tint/20 p-4">
                <p className="m-0 text-[15px] leading-[23px] font-medium text-ink">
                  {active.resumeBullet}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-line pt-4">
              <span className="text-xs font-bold tracking-wider text-ink-muted">MATCHED REQUIREMENTS</span>
              <div className="flex flex-wrap gap-1.5">
                {active.matchedSkills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1 rounded border border-line bg-canvas px-2 py-1 text-xs text-ink font-semibold"
                  >
                    <Check className="size-3 text-signal" strokeWidth={2.5} />
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
