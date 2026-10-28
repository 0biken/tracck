import { describe, expect, it } from 'vitest';
import { requirementGaps, styleFindings } from './style';
import { DATA_RULE } from './prompts';
import type { PoolEntry } from './verify';

const bullet = (id: string, text: string) => ({ id, text, evidence: ['E1'] });

describe('style checks', () => {
  it('flags filler phrases and em dashes', () => {
    const findings = styleFindings([bullet('b1', 'A passionate engineer who built a payments service.'), bullet('b2', 'Cut latency — by a third.')]);
    expect(findings).toEqual([
      expect.objectContaining({ bullet: 'b1', kind: 'tone' }),
      expect.objectContaining({ bullet: 'b2', kind: 'tone' }),
    ]);
  });

  it('flags an opener that several bullets share, from the third on', () => {
    const findings = styleFindings([
      bullet('b1', 'Built a billing service in TypeScript.'),
      bullet('b2', 'Built a queue worker for card retries.'),
      bullet('b3', 'Built an audit log for ledger changes.'),
    ]);
    expect(findings.map((finding) => finding.bullet)).toEqual(['b3']);
  });

  it('flags a bullet that makes a point already made', () => {
    const findings = styleFindings([
      bullet('b1', 'Reduced checkout latency for mobile shoppers by a third using Redis caching.'),
      bullet('b2', 'Cut mobile checkout latency by a third through Redis caching.'),
    ]);
    expect(findings).toEqual([expect.objectContaining({ bullet: 'b2', kind: 'repetition' })]);
  });

  it('is quiet on plain, distinct bullets', () => {
    expect(styleFindings([bullet('b1', 'Built a billing service in TypeScript.'), bullet('b2', 'Led a migration of the search index.')])).toEqual([]);
  });
});

describe('requirement gaps', () => {
  const pool = new Map<string, PoolEntry>([
    ['E1', { ref: 'E1', id: 'ev-1', text: 'Built a billing API in TypeScript and PostgreSQL.', skills: ['TypeScript', 'PostgreSQL'] }],
  ]);

  it('lists a required skill the evidence supports but the draft leaves out', () => {
    expect(requirementGaps(['TypeScript', 'PostgreSQL', 'Kubernetes'], pool, [bullet('b1', 'Built a billing API in TypeScript.')])).toEqual(['PostgreSQL']);
  });
});

describe('prompt guard', () => {
  it('names every tag that carries outside text, including the source material', () => {
    expect(DATA_RULE).toContain('<source>');
    expect(DATA_RULE).toContain('<known_skills>');
  });
});
