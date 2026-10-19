export type ResumeStatus = 'exported' | 'draft' | 'failed'

export type ResumeSummary = {
  /** URL segment. */
  id: string
  company: string
  title: string
  role: string
  length: 'One page' | 'Full'
  score: number | null
  created: string
  status: ResumeStatus
  /** Shown after "DRAFT", for example when new entries arrived. */
  note?: string
}

export const RESUMES: ResumeSummary[] = [
  { id: 'kora-payments', company: 'Kora Payments', title: 'Backend Engineer Intern', role: 'Developer', length: 'One page', score: 82, created: '2026.10.09', status: 'exported' },
  { id: 'lagos-cloud-co', company: 'Lagos Cloud Co', title: 'Junior Platform Engineer', role: 'Developer', length: 'Full', score: 74, created: '2026.10.03', status: 'draft', note: '12 new entries' },
  { id: 'go-payments', company: '[COMPANY]', title: 'Go Developer, Payments', role: 'Developer', length: 'One page', score: 79, created: '2026.09.21', status: 'exported' },
  { id: 'gdg-ibadan', company: 'Google Developer Groups', title: 'Community Lead, Ibadan', role: 'Dev Rel and Community', length: 'One page', score: 71, created: '2026.09.02', status: 'exported' },
  { id: 'nysc-placement', company: '[COMPANY]', title: 'Backend Developer, NYSC placement', role: 'Developer', length: 'One page', score: 68, created: '2026.08.27', status: 'exported' },
  { id: 'fintech-startup', company: 'Fintech Startup', title: 'Software Engineering Intern', role: 'Developer', length: 'One page', score: null, created: '2026.08.20', status: 'failed' },
]

export function getResume(id: string) {
  return RESUMES.find((resume) => resume.id === id)
}

export const SAVED_AT = '2026.10.12 21:04'

// ---------------------------------------------------------------------------
// The resume document. Every bullet names the evidence behind it.

export type EvidenceRef = {
  id: string
  source: 'GITHUB' | 'CV' | 'LINKEDIN'
  /** Repo, file or page, shown after the source. */
  where: string
  date: string
  /** The original text the bullet was written from. */
  original: string
}

export const EVIDENCE_REFS: Record<string, EvidenceRef> = {
  'gh-retry-queue': {
    id: 'gh-retry-queue',
    source: 'GITHUB',
    where: 'lemni-billing',
    date: '2026.08.18',
    original: 'feat(billing): add retry queue for failed charges using BullMQ; persist attempts in ledger_entries',
  },
  'cv-billing': {
    id: 'cv-billing',
    source: 'CV',
    where: 'Tolu_CV_2026.pdf · p.1',
    date: '2026.03',
    original: '"Built billing backend for Lemni with NestJS and Postgres"',
  },
  'gh-webhooks': {
    id: 'gh-webhooks',
    source: 'GITHUB',
    where: 'lemni-billing · release v1.2.0',
    date: '2026.09.02',
    original: 'v1.2.0: webhook idempotency with Redis locks',
  },
  'gh-smart-retry': {
    id: 'gh-smart-retry',
    source: 'GITHUB',
    where: 'lemni-billing',
    date: '2026.08.18',
    original: 'Retry schedules for declined cards (no before-and-after figures recorded)',
  },
  'gh-hash-ring': {
    id: 'gh-hash-ring',
    source: 'GITHUB',
    where: 'consistent-hash-go',
    date: '2026.07.12',
    original: 'Ring with virtual nodes, rebalancing tests and benchmark results in README',
  },
  'cv-logistics': {
    id: 'cv-logistics',
    source: 'CV',
    where: 'Tolu_CV_2026.pdf · p.1',
    date: '2025',
    original: '"Dockerised a NestJS API and set up GitHub Actions deploys to staging and production for a logistics client"',
  },
  'cv-reports': {
    id: 'cv-reports',
    source: 'CV',
    where: 'Tolu_CV_2026.pdf · p.1',
    date: '2025',
    original: '"Moved slow report generation to background jobs"',
  },
  'cv-nacos': {
    id: 'cv-nacos',
    source: 'CV',
    where: 'Tolu_CV_2026.pdf · p.2',
    date: '2025',
    original: '"General Secretary, NACOS UI: organised monthly technical sessions"',
  },
}

export type Bullet = {
  id: string
  text: string
  evidence: string[]
  /** Set when the bullet implies a figure the evidence does not contain. */
  needsNumber?: boolean
}

export type ResumeGroup = { title?: string; year?: string; bullets: Bullet[] }
export type ResumeSection =
  | { id: string; heading: string; kind: 'text'; text: string }
  | { id: string; heading: string; kind: 'groups'; groups: ResumeGroup[] }

export const RESUME_HEADER = {
  name: 'Tolu Adebayo',
  contact: 'Ibadan, Nigeria · tolu@ui.edu.ng · github.com/toluadebayo · [PHONE]',
}

export const RESUME_SECTIONS: ResumeSection[] = [
  {
    id: 'summary',
    heading: 'SUMMARY',
    kind: 'text',
    text: 'Backend developer and Computer Science student at the University of Ibadan building payment and billing services in NestJS and Go, with Postgres, Redis and BullMQ.',
  },
  {
    id: 'projects',
    heading: 'PROJECTS',
    kind: 'groups',
    groups: [
      {
        title: 'Lemni — Subscription billing engine',
        year: '2026',
        bullets: [
          {
            id: 'b1',
            text: 'Built a NestJS subscription billing service that retries failed card charges through BullMQ queues backed by Postgres ledger tables.',
            evidence: ['gh-retry-queue', 'cv-billing'],
          },
          {
            id: 'b2',
            text: 'Designed idempotent webhook handling for Paystack events using Redis locks to prevent double charges.',
            evidence: ['gh-webhooks'],
          },
          {
            id: 'b3',
            text: 'Reduced failed renewals by implementing smart retry schedules for declined cards.',
            evidence: ['gh-smart-retry'],
            needsNumber: true,
          },
        ],
      },
      {
        title: 'Consistent hashing library (Go)',
        year: '2026',
        bullets: [
          {
            id: 'b4',
            text: 'Implemented a consistent hashing ring in Go with virtual nodes and published benchmarks for cache sharding.',
            evidence: ['gh-hash-ring'],
          },
        ],
      },
    ],
  },
  {
    id: 'experience',
    heading: 'EXPERIENCE',
    kind: 'groups',
    groups: [
      {
        title: 'Backend Developer (Contract) — Logistics client',
        year: '2025',
        bullets: [
          {
            id: 'b5',
            text: 'Containerised a NestJS API with Docker and shipped it through a GitHub Actions pipeline to staging and production.',
            evidence: ['cv-logistics'],
          },
          {
            id: 'b6',
            text: 'Moved slow report generation to background jobs on BullMQ so requests return immediately.',
            evidence: ['cv-reports'],
          },
        ],
      },
    ],
  },
  {
    id: 'leadership',
    heading: 'LEADERSHIP',
    kind: 'groups',
    groups: [
      {
        bullets: [
          {
            id: 'b7',
            text: 'General Secretary, NACOS UI: organised monthly technical sessions for the faculty community.',
            evidence: ['cv-nacos'],
          },
        ],
      },
    ],
  },
  { id: 'skills', heading: 'SKILLS', kind: 'text', text: 'Go, TypeScript, NestJS, PostgreSQL, Redis, BullMQ, Docker, GitHub Actions' },
  { id: 'education', heading: 'EDUCATION', kind: 'text', text: 'B.Sc. Computer Science, University of Ibadan — expected [YEAR]' },
]

export const JOB_DESCRIPTION = `Backend Engineer Intern — Kora Payments, Lagos (hybrid)

We are looking for a backend intern to work on our subscription and payouts services.

Requirements
- Strong fundamentals in Node.js or Go
- Experience with PostgreSQL and Redis
- Familiarity with message queues (BullMQ, RabbitMQ or Kafka)
- Docker and CI/CD
- Nice to have: Kubernetes, payments domain experience`

export const JOB_FOCUS = 'Emphasise backend and payments work, especially the billing engine.'

export const REQUIREMENTS = [
  { label: 'Node.js or Go', covered: true, detail: '4 bullets' },
  { label: 'PostgreSQL, Redis', covered: true, detail: '3 bullets' },
  { label: 'Message queues', covered: true, detail: '2 bullets' },
  { label: 'Payments', covered: true, detail: '2 bullets' },
  { label: 'Kubernetes', covered: false, detail: 'no evidence in your record. Not claimed.' },
]

/** The requirements read from a pasted job description. */
export const JOB_READING = {
  required: ['Node.js or Go', 'PostgreSQL', 'Redis', 'Message queues', 'Docker', 'CI/CD'],
  preferred: ['Kubernetes', 'Payments'],
}

/** Steps of generation, in order (matches the design system's step names). */
export const GENERATION_STEPS = [
  { title: 'Reading the job', done: '6 required and 2 preferred requirements found', time: '00:04' },
  { title: 'Finding your evidence', done: '24 of 148 entries ranked relevant', time: '00:11' },
  { title: 'Writing', done: 'Draft 1 done. Checking and improving: pass 2 of 3', time: '00:37' },
  { title: 'Checking against your role', done: '', time: '' },
  { title: 'Formatting to one page', done: '', time: '' },
] as const

export const EVIDENCE_IN_USE = [
  { where: 'GITHUB · 2026.08.18 · lemni-billing', text: 'Subscription billing engine with retry queue on BullMQ and Postgres ledger tables', matches: 'message queues, PostgreSQL, payments' },
  { where: 'GITHUB · 2026.07.12 · consistent-hash-go', text: 'Consistent hashing ring in Go with virtual nodes and benchmarks', matches: 'Go' },
  { where: 'CV · 2025 · Client project', text: 'Dockerised NestJS API deployed with GitHub Actions for a logistics client', matches: 'Docker, CI/CD, Node.js' },
  { where: 'GITHUB · 2026.05.30 · rate-limiter', text: 'Redis sliding-window rate limiter middleware', matches: 'Redis' },
]
