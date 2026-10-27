import { describe, expect, it } from 'vitest';
import { PlaceholderEngine } from './placeholder-engine';

describe('placeholder reader', () => {
  it('keeps the end of a long README, in claims that each fit', async () => {
    const readme = Array.from({ length: 40 }, (_, i) => `Feature ${i + 1} processes payments through idempotent queue workers and ledger tables.`).join(' ');
    const text = `${readme} The last thing the owner built was the reconciliation report.`;
    const entries = await new PlaceholderEngine().extractEvidence({
      id: 'doc-1',
      provider: 'github',
      kind: 'github_repo',
      title: 'devops-project',
      text,
      url: null,
      date: null,
      where: 'devops-project',
    });

    expect(entries.map((entry) => entry.claimText).join(' ')).toContain('reconciliation report.');
    expect(Math.max(...entries.map((entry) => entry.claimText.length))).toBeLessThanOrEqual(600);
    expect(entries.every((entry) => entry.title === 'devops-project')).toBe(true);
  });
});
