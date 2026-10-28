// Checks on how a draft reads, and on what it leaves out. These are rules a program can apply
// exactly, so they run here and the critic is left with judgement only.

import type { Finding, BulletDraft, PoolEntry } from './verify';

/** Phrases recruiters read as filler. Matched as whole words, ignoring case. */
const BANNED = [
  'passionate',
  'passionate about',
  'dynamic',
  'seamless',
  'seamlessly',
  'leverage',
  'cutting-edge',
  'game-changing',
  'pivotal',
  'crucial',
  'testament to',
  'synergy',
  'results-driven',
  'proven track record',
];
const BANNED_PATTERN = new RegExp(`\\b(${BANNED.map((phrase) => phrase.replace(/[-\s]/g, (char) => (char === ' ' ? '\\s+' : '\\-'))).join('|')})\\b`, 'i');

/** A repeated opener is only flagged from this many bullets on. */
const OPENER_LIMIT = 3;
/** Two bullets are the same point when this much of their wording is shared. */
const SIMILAR = 0.6;

const STOP = new Set(['with', 'from', 'that', 'this', 'into', 'across', 'their', 'using', 'and', 'the', 'for', 'were', 'was', 'had']);

const words = (text: string) =>
  new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9+#.]+/)
      .filter((word) => word.length > 3 && !STOP.has(word)),
  );

function overlap(a: Set<string>, b: Set<string>) {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const word of a) if (b.has(word)) shared += 1;
  return shared / (a.size + b.size - shared);
}

/** Style problems in the draft: filler phrases, em dashes, one opener used again and again, and repeated points. */
export function styleFindings(bullets: BulletDraft[]): Finding[] {
  const findings: Finding[] = [];
  const add = (bullet: string, kind: Finding['kind'], reason: string) => findings.push({ bullet, kind, severity: 'soft', reason });

  const openers = new Map<string, number>();
  const seen: { id: string; words: Set<string> }[] = [];

  for (const bullet of bullets) {
    const banned = BANNED_PATTERN.exec(bullet.text);
    if (banned) add(bullet.id, 'tone', `Uses the filler phrase "${banned[0]}".`);
    if (/[—–]/.test(bullet.text)) add(bullet.id, 'tone', 'Uses an em dash.');

    const opener = bullet.text.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
    const count = (openers.get(opener) ?? 0) + 1;
    openers.set(opener, count);
    if (opener && count >= OPENER_LIMIT) add(bullet.id, 'tone', `Starts with "${opener}", as several other bullets do.`);

    const own = words(bullet.text);
    const twin = seen.find((earlier) => overlap(earlier.words, own) >= SIMILAR);
    if (twin) add(bullet.id, 'repetition', `Makes the same point as (${twin.id}).`);
    seen.push({ id: bullet.id, words: own });
  }
  return findings;
}

/**
 * Required skills the evidence supports but the draft does not show. An applicant tracking
 * system matches the job's wording, so a skill the person has but did not write is a gap.
 */
export function requirementGaps(required: string[], pool: Map<string, PoolEntry>, bullets: BulletDraft[]): string[] {
  const evidence = [...pool.values()].map((entry) => `${entry.text} ${entry.skills.join(' ')}`.toLowerCase());
  const draft = bullets.map((bullet) => bullet.text.toLowerCase());
  return [...new Set(required)].filter((skill) => {
    const name = skill.toLowerCase();
    return evidence.some((text) => text.includes(name)) && !draft.some((text) => text.includes(name));
  });
}
