// ── Platform detection ────────────────────────────────────────────────────────

export type ScrapePlatform =
  | 'linkedin'
  | 'instagram'
  | 'twitter'
  | 'behance'
  | 'dribbble'
  | 'github'
  | 'generic';

export interface PlatformMeta {
  id: ScrapePlatform;
  label: string;
  /** Whether a public-page scrape is realistically useful */
  scrapable: boolean;
  /** Reason scraping is limited (only set when scrapable = false) */
  scrapeLimit?: string;
  /** Whether we support Archive ZIP import for this platform */
  supportsZipImport: boolean;
  /** Which file inside the ZIP to look for (if supportsZipImport) */
  zipFile?: string;
}

export const PLATFORM_META: Record<ScrapePlatform, PlatformMeta> = {
  linkedin: {
    id: 'linkedin',
    label: 'LinkedIn',
    scrapable: true,
    supportsZipImport: true,
    zipFile: 'Shares.csv',
  },
  instagram: {
    id: 'instagram',
    label: 'Instagram',
    scrapable: true,
    supportsZipImport: true,
    zipFile: 'content/posts_1.json',
  },
  twitter: {
    id: 'twitter',
    label: 'Twitter / X',
    scrapable: false,
    scrapeLimit:
      'Twitter/X requires a login to view any tweets since 2023. Use Archive ZIP import instead — X lets you download your full tweet history from Settings.',
    supportsZipImport: true,
    zipFile: 'data/tweets.js',
  },
  behance: {
    id: 'behance',
    label: 'Behance',
    scrapable: true,
    supportsZipImport: false,
  },
  dribbble: {
    id: 'dribbble',
    label: 'Dribbble',
    scrapable: true,
    supportsZipImport: false,
  },
  github: {
    id: 'github',
    label: 'GitHub',
    scrapable: true,
    supportsZipImport: false,
  },
  generic: {
    id: 'generic',
    label: 'Website',
    scrapable: true,
    supportsZipImport: false,
  },
};

/** Infer the platform from a URL string. Returns 'generic' on unknown/invalid URLs. */
export function detectPlatform(url: string): ScrapePlatform {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes('linkedin.com')) return 'linkedin';
    if (hostname.includes('instagram.com')) return 'instagram';
    if (hostname.includes('twitter.com') || hostname.includes('x.com')) return 'twitter';
    if (hostname.includes('behance.net')) return 'behance';
    if (hostname.includes('dribbble.com')) return 'dribbble';
    if (hostname.includes('github.com')) return 'github';
    return 'generic';
  } catch {
    return 'generic';
  }
}

// ── Shared segment type ────────────────────────────────────────────────────────

export interface ContentSegment {
  text: string;
  /** e.g. 'about', 'experience', 'post', 'project', 'caption', 'generic' */
  type: string;
  /** ISO date string if we could detect one */
  date?: string;
  /** e.g. company name for LinkedIn experience */
  context?: string;
}
