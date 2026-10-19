export type KeyScope = 'generate:resume' | 'read:resume' | 'read:profile'

export type ApiKey = {
  id: string
  label: string
  note: string
  prefix: string
  scopes: KeyScope[]
  limits: string[]
  lastUsed: string
  lastUsedFrom?: string
  expires: string
  state: 'active' | 'rotating' | 'revoked'
}

export const API_KEYS: ApiKey[] = [
  {
    id: 'k1',
    label: 'Production',
    note: 'LIVE · CREATED 2026.09.14',
    prefix: 'trk_live_8f2a…',
    scopes: ['generate:resume', 'read:resume', 'read:profile'],
    limits: ['60 / min', '5,000 / month'],
    lastUsed: '2026.10.12 20:51',
    lastUsedFrom: '102.89.x.x',
    expires: '2027.09.14',
    state: 'active',
  },
  {
    id: 'k2',
    label: 'Production (rotating)',
    note: 'OLD KEY STOPS 2026.10.19',
    prefix: 'trk_live_31cd…',
    scopes: ['generate:resume', 'read:resume'],
    limits: ['60 / min', 'shared quota'],
    lastUsed: '2026.10.10 09:12',
    expires: '2026.10.19',
    state: 'rotating',
  },
  {
    id: 'k3',
    label: 'Sandbox',
    note: 'SYNTHETIC DATA ONLY',
    prefix: 'trk_test_c09e…',
    scopes: ['generate:resume', 'read:resume', 'read:profile'],
    limits: ['20 / min', '500 / month'],
    lastUsed: '2026.10.08 14:30',
    expires: 'Never',
    state: 'active',
  },
  {
    id: 'k4',
    label: 'Old pilot key',
    note: 'REVOKED 2026.09.14 BY F. LAWAL',
    prefix: 'trk_live_a7b2…',
    scopes: [],
    limits: [],
    lastUsed: '2026.09.13',
    expires: '—',
    state: 'revoked',
  },
]

export const ALL_SCOPES: KeyScope[] = ['generate:resume', 'read:resume', 'read:profile']

export const USAGE_STATS = [
  { label: 'Resumes generated', value: '1,842', note: 'of 5,000 monthly quota' },
  { label: 'API requests', value: '14,203', note: '99.6% succeeded' },
  { label: 'Students consented', value: '612', note: '38 revoked this period' },
  { label: 'Rate-limited', value: '57', note: 'requests at 60 / min' },
]

export const RESUMES_PER_DAY = [42, 55, 61, 38, 22, 70, 88, 100, 76, 49, 57, 33]

export const AUDIT_LOG = [
  { time: '2026.10.12 21:14', event: 'key.created', key: 'trk_live_5b1e', by: 'f.lawal', from: '102.89.34.17' },
  { time: '2026.10.12 20:51', event: 'resume.generated', key: 'trk_live_8f2a', by: 'api', from: '41.58.120.9' },
  { time: '2026.10.12 08:03', event: 'key.rotation_started', key: 'trk_live_31cd', by: 'f.lawal', from: '102.89.34.17' },
  { time: '2026.10.08 14:30', event: 'rate_limit.exceeded', key: 'trk_test_c09e', by: 'api', from: '197.210.8.44', alert: true },
  { time: '2026.10.02 11:20', event: 'consent.granted', key: '—', by: 'usr_31c9', from: '—' },
  { time: '2026.09.14 10:05', event: 'key.revoked', key: 'trk_live_a7b2', by: 'f.lawal', from: '102.89.34.17' },
]

export const CONSENT_REQUEST = {
  org: 'ITConnect',
  date: '2026.10.12',
  scopes: [
    { id: 'generate:resume', label: 'Generate resumes for jobs on ITConnect', on: true },
    { id: 'read:resume', label: 'Read resumes you create through ITConnect', on: true },
    { id: 'read:profile', label: 'Read your profile and skills summary', on: false },
  ],
}

export const GRANTED_ORGS = [
  { id: 'unilag', name: 'UNILAG Careers Office', detail: 'READ PROFILE, READ RESUME · GRANTED 2026.10.02', state: 'granted' as const },
  { id: 'itconnect', name: 'ITConnect', detail: 'REQUESTED · GENERATE RESUME', state: 'requested' as const },
]
