import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { ApiKeyView, KeyState } from '@tracck/shared';
import type { KeyScope } from '@tracck/shared';

/** `trk_<live|test>_<8 hex>_<43 characters>`. The prefix finds the key; the rest is the secret. */
const PATTERN = /^trk_(live|test)_([0-9a-f]{8})_([A-Za-z0-9_-]{43})$/;

export interface ParsedKey {
  mode: 'live' | 'test';
  prefix: string;
  secret: string;
}

export function generateKey(mode: 'live' | 'test') {
  const prefix = randomBytes(4).toString('hex');
  const secret = randomBytes(32).toString('base64url');
  return { prefix, secretHash: hashSecret(secret), token: `trk_${mode}_${prefix}_${secret}` };
}

export function parseKey(token: string): ParsedKey | null {
  const match = PATTERN.exec(token);
  return match ? { mode: match[1] as 'live' | 'test', prefix: match[2], secret: match[3] } : null;
}

export const hashSecret = (secret: string) => createHash('sha256').update(secret).digest('hex');

/** Compares hashes in constant time, so how long it takes says nothing about how close a guess was. */
export function secretMatches(secret: string, storedHash: string): boolean {
  const given = Buffer.from(hashSecret(secret), 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  return given.length === stored.length && timingSafeEqual(given, stored);
}

export interface KeyRow {
  id: string;
  prefix: string;
  mode: 'live' | 'test';
  label: string;
  scopes: string[];
  rateLimitPerMin: number;
  monthlyQuota: number | null;
  lastUsedAt: Date | string | null;
  lastUsedIp: string | null;
  expiresAt: Date | string | null;
  stopsAt: Date | string | null;
  revokedAt: Date | string | null;
  createdAt: Date | string;
}

const iso = (value: Date | string | null) => (value ? new Date(value).toISOString() : null);

/** Revoked now, still working while a rotation's grace period runs, or active. */
export function stateOf(row: Pick<KeyRow, 'revokedAt' | 'stopsAt' | 'expiresAt'>, now = new Date()): KeyState {
  if (row.revokedAt) return 'revoked';
  if (row.stopsAt) return new Date(row.stopsAt) > now ? 'rotating' : 'revoked';
  if (row.expiresAt && new Date(row.expiresAt) <= now) return 'revoked';
  return 'active';
}

export function toKeyView(row: KeyRow, now = new Date()): ApiKeyView {
  return {
    id: row.id,
    label: row.label,
    mode: row.mode,
    display: `trk_${row.mode}_${row.prefix}…`,
    scopes: row.scopes as KeyScope[],
    rateLimitPerMin: row.rateLimitPerMin,
    monthlyQuota: row.monthlyQuota,
    lastUsedAt: iso(row.lastUsedAt),
    lastUsedIp: row.lastUsedIp,
    expiresAt: iso(row.expiresAt),
    stopsAt: iso(row.stopsAt),
    revokedAt: iso(row.revokedAt),
    state: stateOf(row, now),
    createdAt: new Date(row.createdAt).toISOString(),
  };
}
