// The deterministic check (PRD DR-7): every number and named skill in a bullet must
// appear in the evidence the bullet cites. No model is involved, so a fluent
// invention cannot talk its way past it.

import { findSkills } from './lexicon';

export interface PoolEntry {
  /** Short handle the writer cites ("E3"). Real IDs are long and easy to garble. */
  ref: string;
  id: string;
  text: string;
  skills: string[];
}

export interface BulletDraft {
  id: string;
  text: string;
  /** Refs into the pool. */
  evidence: string[];
  needsNumber?: boolean;
}

export type FindingKind =
  | 'no_evidence'
  | 'unknown_evidence'
  | 'unsupported_number'
  | 'unsupported_skill'
  | 'unknown_name'
  | 'too_long';

export interface Finding {
  bullet: string;
  kind: FindingKind;
  /** Blocking findings remove the bullet if they cannot be fixed. */
  severity: 'blocking' | 'soft';
  reason: string;
}

const MAX_WORDS = 38;
const NUMBER = /\$?\d[\d,]*(?:\.\d+)?\s?(?:%|k\b|m\b|bn\b|x\b|\+)?/gi;

/** "1,200", "$1.2k", "40 %" and "1200" compare equal; "10k" and "10,000" too. */
export function normalizeNumber(raw: string): string {
  const cleaned = raw.toLowerCase().replace(/[$,\s+]/g, '');
  const match = /^(\d+(?:\.\d+)?)(k|m|bn)?(%|x)?$/.exec(cleaned);
  if (!match) return cleaned;
  const scale = { k: 1e3, m: 1e6, bn: 1e9 }[match[2] as 'k' | 'm' | 'bn'] ?? 1;
  return `${Number(match[1]) * scale}${match[3] ?? ''}`;
}

export function numbersIn(text: string): string[] {
  return (text.match(NUMBER) ?? []).map(normalizeNumber).filter(Boolean);
}

const lower = (text: string) => text.toLowerCase();

export function verifyBullet(bullet: BulletDraft, pool: Map<string, PoolEntry>): Finding[] {
  const findings: Finding[] = [];
  const add = (kind: FindingKind, severity: Finding['severity'], reason: string) =>
    findings.push({ bullet: bullet.id, kind, severity, reason });

  const cited = bullet.evidence.map((ref) => pool.get(ref));
  const unknown = bullet.evidence.filter((ref) => !pool.has(ref));
  if (unknown.length) add('unknown_evidence', 'blocking', `Cites ${unknown.join(', ')}, which are not in the evidence list.`);

  const entries = cited.filter((entry): entry is PoolEntry => entry !== undefined);
  if (entries.length === 0) {
    add('no_evidence', 'blocking', 'Cites no evidence entry.');
    return findings;
  }

  const evidenceText = entries.map((entry) => entry.text).join('\n');
  const evidenceNumbers = new Set(numbersIn(evidenceText));
  for (const number of new Set(numbersIn(bullet.text))) {
    if (!evidenceNumbers.has(number)) {
      add('unsupported_number', 'blocking', `The figure "${number}" is not in the cited evidence.`);
    }
  }

  const evidenceSkills = new Set([...entries.flatMap((entry) => entry.skills.map(lower)), ...findSkills(evidenceText).map(lower)]);
  for (const skill of findSkills(bullet.text)) {
    if (!evidenceSkills.has(lower(skill))) add('unsupported_skill', 'blocking', `"${skill}" is not named in the cited evidence.`);
  }

  // Capitalised words in mid-sentence are usually product, company or place names.
  const haystack = lower(evidenceText);
  const names = bullet.text.match(/(?<=[a-z,;:] )[A-Z][A-Za-z0-9.+#-]{2,}/g) ?? [];
  const known = new Set(findSkills(bullet.text).map(lower));
  for (const name of new Set(names)) {
    if (!known.has(lower(name)) && !haystack.includes(lower(name))) {
      add('unknown_name', 'soft', `"${name}" does not appear in the cited evidence.`);
    }
  }

  if (bullet.text.trim().split(/\s+/).length > MAX_WORDS) {
    add('too_long', 'soft', `Longer than ${MAX_WORDS} words; a recruiter will not read it.`);
  }
  return findings;
}

export function verifyBullets(bullets: BulletDraft[], pool: Map<string, PoolEntry>): Finding[] {
  return bullets.flatMap((bullet) => verifyBullet(bullet, pool));
}

/** Skills the person actually has: only names found in the pool survive. */
export function supportedSkills(skills: string[], pool: Map<string, PoolEntry>): string[] {
  const owned = new Set<string>();
  for (const entry of pool.values()) {
    for (const skill of entry.skills) owned.add(lower(skill));
    for (const skill of findSkills(entry.text)) owned.add(lower(skill));
  }
  return [...new Set(skills.map((skill) => skill.trim()).filter((skill) => owned.has(lower(skill))))];
}
