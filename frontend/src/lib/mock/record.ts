// The user's record: sources, evidence entries, and the Career Graph.

export type SourceStatus = 'ready' | 'collecting' | 'problem'

export type SourceRow = {
  id: string
  name: string
  detail: string
  status: SourceStatus
  statusLabel: string
  sub?: string
  progress?: number
  actions: { label: string; primary?: boolean; danger?: boolean }[]
}

export const SOURCES: SourceRow[] = [
  {
    id: 'github',
    name: 'GitHub',
    detail: '@toluadebayo · full history since 2021.02',
    status: 'ready',
    statusLabel: 'READY · 96 ENTRIES',
    sub: 'Last collected 2026.10.12 06:00',
    actions: [{ label: 'Refresh' }, { label: 'Disconnect', danger: true }],
  },
  {
    id: 'cv',
    name: 'CV',
    detail: 'Tolu_CV_2026.pdf · private · kept 12 months',
    status: 'ready',
    statusLabel: 'READY · 52 ENTRIES',
    sub: '4 weaknesses found',
    actions: [{ label: 'Replace file' }, { label: 'Delete' }],
  },
  {
    id: 'linkedin',
    name: 'LinkedIn data export',
    detail: 'Basic_LinkedInDataExport_10-11-2026.zip',
    status: 'collecting',
    statusLabel: 'COLLECTING · 214 / 380 ITEMS',
    progress: 56,
    actions: [{ label: 'Cancel' }],
  },
  {
    id: 'portfolio',
    name: 'Portfolio',
    detail: 'tolu.dev',
    status: 'problem',
    statusLabel: 'PROBLEM',
    sub: 'The page returned an error. Check it is public, or paste the text instead.',
    actions: [{ label: 'Retry', primary: true }, { label: 'Paste text' }],
  },
]

export const ADD_SOURCES = [
  { name: 'X', body: 'Upload your X archive or paste key posts. Direct connection depends on access.', action: 'Upload archive' },
  { name: 'Behance', body: 'Paste your profile or project links.', action: 'Paste links' },
  { name: 'Figma', body: 'Coming in a later phase.', soon: true },
  { name: 'Manual entry', body: 'For work with no public trace. Tracck suggests clearer wording; you approve it.', action: 'Add manually' },
]

/** Onboarding collection progress. */
export const COLLECTION = [
  { name: 'GitHub', state: 'ready', progress: 100, detail: '42 REPOS · 96 ENTRIES KEPT · 1,214 ITEMS READ', label: 'READY' },
  { name: 'CV', state: 'collecting', progress: 72, detail: 'READING PAGE 2 OF 2 · 38 ENTRIES SO FAR', label: 'COLLECTING' },
  { name: 'LinkedIn export', state: 'waiting', progress: 0, detail: 'QUEUED', label: 'WAITING' },
  { name: 'Portfolio', state: 'problem', progress: 0, detail: 'tolu.dev returned an error. Check the page is public, or paste the text.', label: 'PROBLEM' },
] as const

// ---------------------------------------------------------------------------
// Evidence library

export type EntrySource = 'GITHUB' | 'CV' | 'LINKEDIN' | 'MANUAL'

export type EvidenceEntry = {
  id: string
  number: string
  source: EntrySource
  /** Date and where, after the source name. */
  meta: string
  title: string
  body: string
  skills: string[]
  pinned?: boolean
  excluded?: boolean
  edited?: boolean
  usedIn?: number
  /** The original text the entry was taken from. */
  original: string
}

export const ENTRIES: EvidenceEntry[] = [
  {
    id: 'e118',
    number: '118',
    source: 'GITHUB',
    meta: '2026.08.18 · lemni-billing',
    title: 'Retry queue for failed card charges',
    body: 'Added BullMQ retry queue for failed charges; attempts persisted in ledger_entries.',
    skills: ['BullMQ', 'PostgreSQL', 'Payments'],
    pinned: true,
    original: 'feat(billing): add retry queue for failed charges using BullMQ; persist attempts in ledger_entries',
  },
  {
    id: 'e097',
    number: '097',
    source: 'GITHUB',
    meta: '2026.07.12 · consistent-hash-go',
    title: 'Consistent hashing ring in Go',
    body: 'Ring with virtual nodes, rebalancing tests and benchmark results in README.',
    skills: ['Go', 'Distributed systems'],
    usedIn: 2,
    original: 'README: consistent hashing ring, 150 virtual nodes per server, rebalancing tests and benchmark results.',
  },
  {
    id: 'e031',
    number: '031',
    source: 'CV',
    meta: '2024',
    title: 'Secondary school ICT club coordinator',
    body: 'Never used in a resume.',
    skills: [],
    excluded: true,
    original: '"Coordinator, school ICT club"',
  },
  {
    id: 'e064',
    number: '064',
    source: 'CV',
    meta: '2025',
    title: 'Containerised logistics API with CI pipeline',
    body: 'Dockerised a NestJS API and set up GitHub Actions deploys to staging and production for a logistics client.',
    skills: ['Docker', 'GitHub Actions', 'NestJS'],
    edited: true,
    usedIn: 4,
    original: '"Dockerised logistics API and added CI"',
  },
]

export const DUPLICATE_PAIR = {
  a: { source: 'CV · 2026.03', text: 'Built billing backend for Lemni with NestJS and Postgres' },
  b: { source: 'GITHUB · 2026.04.02', text: 'Initial NestJS billing service with Postgres schema' },
}

// ---------------------------------------------------------------------------
// Career Graph

export const MONTHS = [
  { m: 'NOV', v: 18 }, { m: 'DEC', v: 26 }, { m: 'JAN', v: 12 }, { m: 'FEB', v: 40 },
  { m: 'MAR', v: 35 }, { m: 'APR', v: 52 }, { m: 'MAY', v: 48 }, { m: 'JUN', v: 70 },
  { m: 'JUL', v: 100 }, { m: 'AUG', v: 64 }, { m: 'SEP', v: 58 }, { m: 'OCT', v: 30 },
]

export type GraphProject = {
  id: string
  name: string
  count: number
  period?: string
  sources?: number
  summary?: string
  skills?: string[]
  usedIn?: number
  pinned?: boolean
  entries?: { date: string; source: string; text: string }[]
  more?: number
}

export const PROJECTS: GraphProject[] = [
  {
    id: 'lemni',
    name: 'Lemni billing',
    count: 31,
    period: '2026.04 to 2026.09',
    sources: 3,
    summary: 'Subscription billing engine for the Nigerian market, built in NestJS with Postgres, Redis and BullMQ.',
    skills: ['NestJS', 'PostgreSQL', 'Redis', 'BullMQ', 'Docker', 'Paystack API'],
    usedIn: 3,
    entries: [
      { date: '2026.09.02', source: 'GITHUB RELEASE', text: 'v1.2.0: webhook idempotency with Redis locks' },
      { date: '2026.08.18', source: 'GITHUB', text: 'Retry queue for failed charges using BullMQ; attempts stored in ledger tables' },
      { date: '2026.06.11', source: 'LINKEDIN POST', text: 'Wrote about designing a double-entry ledger for subscriptions' },
      { date: '2026.03', source: 'CV', text: '"Built billing backend for Lemni with NestJS and Postgres"' },
    ],
    more: 27,
  },
  {
    id: 'hash',
    name: 'consistent-hash-go',
    count: 14,
    period: '2026.05 to 2026.07',
    sources: 1,
    summary: 'A consistent hashing ring in Go with virtual nodes, rebalancing tests and published benchmarks.',
    skills: ['Go', 'Distributed systems'],
    usedIn: 2,
    entries: [
      { date: '2026.07.12', source: 'GITHUB', text: 'Consistent hashing ring in Go with virtual nodes and benchmark results' },
    ],
    more: 13,
  },
  {
    id: 'logistics',
    name: 'Logistics API (client)',
    count: 12,
    period: '2025',
    sources: 1,
    summary: 'Contract backend work on a NestJS API for a logistics client, deployed with Docker and GitHub Actions.',
    skills: ['NestJS', 'Docker', 'GitHub Actions'],
    usedIn: 4,
    entries: [{ date: '2025', source: 'CV', text: 'Dockerised a NestJS API and set up GitHub Actions deploys to staging and production' }],
    more: 11,
  },
  { id: 'rate', name: 'rate-limiter', count: 9, period: '2026.05', sources: 1, summary: 'A Redis sliding-window rate limiter middleware.', skills: ['Redis'], usedIn: 1, entries: [{ date: '2026.05.30', source: 'GITHUB', text: 'Redis sliding-window rate limiter middleware' }], more: 8 },
  { id: 'nacos', name: 'NACOS UI sessions', count: 8, period: '2025', sources: 1, summary: 'Monthly technical sessions organised as General Secretary of NACOS UI.', skills: ['Community events'], usedIn: 1, entries: [{ date: '2025', source: 'CV', text: 'General Secretary, NACOS UI: organised monthly technical sessions' }], more: 7 },
  { id: 'cdc', name: 'Postgres CDC migration', count: 7, period: '2026.08 to 2026.09', sources: 1, summary: 'Change-data-capture migration with Kafka and Debezium.', skills: ['Kafka / Debezium', 'PostgreSQL'], usedIn: 0, entries: [{ date: '2026.09', source: 'GITHUB', text: 'Debezium connector for Postgres CDC' }], more: 6 },
]

export const MORE_PROJECTS = 5

export const SKILLS_BY_EVIDENCE = [
  ['TypeScript / NestJS', 48], ['PostgreSQL', 37], ['Go', 22], ['Redis', 19],
  ['BullMQ', 15], ['Docker', 14], ['Kafka / Debezium', 7], ['Community events', 8],
] as const

// ---------------------------------------------------------------------------
// CV feedback

export const CV_FEEDBACK = {
  file: 'Tolu_CV_2026.pdf',
  read: '2026.10.11',
  stats: [
    { n: 5, label: 'bullets without numbers' },
    { n: 3, label: 'weak verbs' },
    { n: 1, label: 'missing section' },
    { n: 1, label: 'format risk for ATS' },
  ],
  issues: [
    {
      title: 'No projects section',
      body: 'Developer resumes lead with projects and skills. Your strongest work (Lemni billing, consistent-hash-go) only appears on GitHub.',
    },
    {
      title: 'Results without numbers',
      body: 'Five bullets describe an improvement but give no figure. Only you know these numbers.',
      quote: '"Improved API performance for the logistics dashboard"',
      fix: 'Add the before and after, if you measured it. If you did not, describe what changed instead.',
    },
    {
      title: 'Weak opening verbs',
      body: '"Helped with", "Worked on" and "Responsible for" hide what you did.',
      quote: '"Worked on the backend for a school portal"',
      fix: 'Start with what you built, shipped or designed.',
    },
    {
      title: 'Two-column layout',
      body: 'Many applicant tracking systems read columns out of order. Tracck exports a single column with standard headings.',
    },
  ],
}
