// Fixed lists the API and the frontend both read: roles, plans, scopes.

// ─── Roles ───────────────────────────────────────────────────────────────────

export const ROLE_IDS = ['dev', 'devrel', 'smm', 'va', 'ux', 'da'] as const;
export type RoleId = (typeof ROLE_IDS)[number];

export interface RoleProfile {
  id: RoleId;
  name: string;
  leads: string;
  emphasis: string;
}

export const ROLES: RoleProfile[] = [
  { id: 'dev', name: 'Developer', leads: 'projects and skills', emphasis: 'Stack, scale, shipped work, repo links.' },
  { id: 'devrel', name: 'Dev Rel and Community', leads: 'events and programmes', emphasis: 'Audience sizes, talks, community outcomes.' },
  { id: 'smm', name: 'Social Media Manager', leads: 'results', emphasis: 'Growth and engagement figures, campaigns, tools.' },
  { id: 'va', name: 'Virtual Assistant', leads: 'tools and processes', emphasis: 'Systems used, improvements, volume handled.' },
  { id: 'ux', name: 'UI/UX Designer', leads: 'case studies', emphasis: 'Process, research, outcomes, portfolio links.' },
  { id: 'da', name: 'Data Analyst', leads: 'analysis work', emphasis: 'Methods, datasets, insights and decisions.' },
];

// ─── Plans ───────────────────────────────────────────────────────────────────

/** What is stored on the profile. */
export type PlanId = 'free' | 'pro';

export interface Entitlements {
  /** Sources that can be connected at once; null means no limit. */
  maxSources: number | null;
  /** Resumes that can be generated per month; null means no limit (within fair use). */
  resumesPerMonth: number | null;
  fullLength: boolean;
  docxExport: boolean;
  matchReport: boolean;
}

export const FREE_ENTITLEMENTS: Entitlements = {
  maxSources: 1,
  resumesPerMonth: 2,
  fullLength: false,
  docxExport: false,
  matchReport: false,
};

export const PRO_ENTITLEMENTS: Entitlements = {
  maxSources: null,
  resumesPerMonth: null,
  fullLength: true,
  docxExport: true,
  matchReport: true,
};

export function entitlementsFor(plan: PlanId): Entitlements {
  return plan === 'pro' ? PRO_ENTITLEMENTS : FREE_ENTITLEMENTS;
}

/** Monthly price of Pro in kobo (1 naira = 100 kobo). Money is never stored as a float. */
export const PRO_PRICE_KOBO = 250_000;

/** The text of the pricing and settings plan cards. */
export interface PlanCard {
  id: PlanId;
  eyebrow: string;
  name: string;
  price: string;
  blurb: string;
  settingsBlurb?: string;
  features: string[];
}

const PAID_FEATURES = [
  'All sources',
  'Unlimited resumes',
  'One page and full',
  'PDF and DOCX',
  'Match report with gap suggestions',
  'Evidence library',
];

export const PLAN_CARDS: Record<PlanCard['id'], PlanCard> = {
  free: {
    id: 'free',
    eyebrow: 'Free',
    name: 'Free',
    price: '₦0',
    blurb: 'Try it on your next application.',
    settingsBlurb: '1 source, 2 resumes a month, one page, PDF export.',
    features: ['1 source', '2 resumes a month', 'One page only', 'PDF export'],
  },
  pro: {
    id: 'pro',
    eyebrow: 'Pro',
    name: 'Pro',
    price: '₦2,500',
    blurb: 'For students, corpers, self-taught builders and working professionals.',
    settingsBlurb: 'All sources, unlimited resumes, one page and full, DOCX, match report, evidence library.',
    features: PAID_FEATURES,
  },
};

// ─── Waitlist ────────────────────────────────────────────────────────────────

export const ORG_TYPES = [
  { value: 'university', label: 'University or careers office' },
  { value: 'bootcamp', label: 'Bootcamp or training programme' },
  { value: 'job_platform', label: 'Job platform or recruiter' },
  { value: 'other', label: 'Something else' },
] as const;
export type OrgType = (typeof ORG_TYPES)[number]['value'];

// ─── Policies ────────────────────────────────────────────────────────────────

/** Bump when the Terms, Privacy Policy or AI-processing text changes. */
export const POLICY_TEXT_VERSION = '2026-10-19';
export const POLICY_PURPOSES = ['terms', 'privacy', 'ai_processing'] as const;
export type PolicyPurpose = (typeof POLICY_PURPOSES)[number];
