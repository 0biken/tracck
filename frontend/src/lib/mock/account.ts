// Fixture data for the product screens. None of this is real: the API has no
// endpoints for entries, sources or resumes yet. Each screen imports from here
// so replacing a fixture with a real query is a one-file change.

export const MOCK_USER = {
  name: 'Tolu Adebayo',
  email: 'tolu@ui.edu.ng',
  initials: 'TA',
  location: 'Ibadan, Nigeria',
  roles: ['Developer', 'Dev Rel and Community'],
  primaryRole: 'Developer',
} as const

export const MOCK_ORG = {
  name: 'UNILAG Careers Office',
  shortName: 'UNILAG CAREERS',
  adminName: 'Funmi Lawal',
  adminInitials: 'UC',
  plan: 'Partner plan',
  clientId: 'org_7Hq2',
} as const

/** Totals shown in the side menu, on Home and on the record pages. */
export const ACCOUNT = {
  today: '2026.10.12',
  entries: 148,
  entriesDelta: '+12 since 2026.10.05',
  pinned: 4,
  excluded: 6,
  duplicates: 3,
  edited: 9,
  projects: 11,
  skills: 34,
  sourcesTotal: 3,
  sourcesReady: 2,
  resumes: 6,
  exported: 4,
  lastExported: '2026.10.09',
  resumesUsed: 1,
  resumesLimit: 2,
  resetsOn: '2026.11.01',
  nextRefresh: '2026.10.13 06:00',
  graphUpdated: '2026.10.12 06:00',
  bySource: { github: 96, cv: 52, linkedin: 0, manual: 0 },
} as const

export type RoleId = 'dev' | 'devrel' | 'smm' | 'va' | 'ux' | 'da'

export const ROLES: { id: RoleId; name: string; leads: string; emphasis: string }[] = [
  { id: 'dev', name: 'Developer', leads: 'projects and skills', emphasis: 'Stack, scale, shipped work, repo links.' },
  { id: 'devrel', name: 'Dev Rel and Community', leads: 'events and programmes', emphasis: 'Audience sizes, talks, community outcomes.' },
  { id: 'smm', name: 'Social Media Manager', leads: 'results', emphasis: 'Growth and engagement figures, campaigns, tools.' },
  { id: 'va', name: 'Virtual Assistant', leads: 'tools and processes', emphasis: 'Systems used, improvements, volume handled.' },
  { id: 'ux', name: 'UI/UX Designer', leads: 'case studies', emphasis: 'Process, research, outcomes, portfolio links.' },
  { id: 'da', name: 'Data Analyst', leads: 'analysis work', emphasis: 'Methods, datasets, insights and decisions.' },
]

export const PLANS = {
  free: {
    id: 'free',
    eyebrow: 'Free',
    name: 'Free',
    price: '₦0',
    blurb: 'Try it on your next application.',
    settingsBlurb: '1 source, 2 resumes a month, one page, PDF export.',
    features: ['1 source', '2 resumes a month', 'One page only', 'PDF export'],
  },
  student: {
    id: 'student',
    eyebrow: 'Students',
    name: 'Student Plus',
    price: '₦1,000',
    blurb: 'Everything in Pro for students. Verify with an .edu.ng email.',
    features: [
      'All sources',
      'Unlimited resumes',
      'One page and full',
      'PDF and DOCX',
      'Match report with gap suggestions',
      'Evidence library',
    ],
  },
  pro: {
    id: 'pro',
    eyebrow: 'Pro',
    name: 'Pro',
    price: '₦2,500',
    blurb: 'For corpers, self-taught builders and working professionals.',
    settingsBlurb: 'All sources, unlimited resumes, one page and full, DOCX, match report, evidence library.',
    features: [
      'All sources',
      'Unlimited resumes',
      'One page and full',
      'PDF and DOCX',
      'Match report with gap suggestions',
      'Evidence library',
    ],
  },
} as const
