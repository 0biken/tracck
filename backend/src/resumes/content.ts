import type { Bullet, MatchReport, ResumeContent, ResumeGroup } from '@tracck/shared';
import type { JobReading } from '../ai/ai-engine';

export interface BulletLocation {
  section: number;
  group: number;
  index: number;
  bullet: Bullet;
}

export function* bulletsOf(content: ResumeContent): Generator<BulletLocation> {
  for (const [section, block] of content.sections.entries()) {
    if (block.kind !== 'groups') continue;
    for (const [group, g] of block.groups.entries()) {
      for (const [index, bullet] of g.bullets.entries()) yield { section, group, index, bullet };
    }
  }
}

export const findBullet = (content: ResumeContent, bulletId: string) =>
  [...bulletsOf(content)].find((location) => location.bullet.id === bulletId) ?? null;

export const groupAt = (content: ResumeContent, location: BulletLocation): ResumeGroup => {
  const section = content.sections[location.section];
  if (section.kind !== 'groups') throw new Error('Not a group section');
  return section.groups[location.group];
};

/** A deep copy, so an edit never changes a stored version. */
export const cloneContent = (content: ResumeContent): ResumeContent => structuredClone(content);

/** The resume as plain text, for search and for the exports' text layer. */
export function plainText(content: ResumeContent): string {
  const lines = [content.header.name, content.header.contact, ''];
  for (const section of content.sections) {
    lines.push(section.heading.toUpperCase());
    if (section.kind === 'text') lines.push(section.text);
    else {
      for (const group of section.groups) {
        if (group.title) lines.push([group.title, group.year].filter(Boolean).join(' · '));
        for (const bullet of group.bullets) lines.push(`- ${bullet.text}`);
      }
    }
    lines.push('');
  }
  return lines.join('\n').trim();
}

const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;
const ONE_PAGE_WORDS = 520;

/**
 * What the draft covers of the job, worked out from the draft itself so the report
 * is the same whichever engine wrote it. Only the score can come from the engine.
 */
export function buildMatch(input: {
  content: ResumeContent;
  reading: Pick<JobReading, 'required' | 'preferred'>;
  engineScore: number | null;
  length: 'one_page' | 'full';
}): MatchReport {
  const { content, reading } = input;
  const bullets = [...bulletsOf(content)].map((location) => location.bullet);
  const haystacks = bullets.map((bullet) =>
    [bullet.text, ...bullet.evidence.map((id) => content.evidenceRefs[id]?.original ?? '')].join(' ').toLowerCase(),
  );
  const skillsText = content.sections.filter((section) => section.kind === 'text').map((section) => (section.kind === 'text' ? section.text : '')).join(' ').toLowerCase();

  const requirement = (label: string, importance: 'required' | 'preferred') => {
    const needle = label.toLowerCase();
    const hits = haystacks.filter((text) => text.includes(needle)).length;
    const listed = skillsText.includes(needle);
    return {
      label,
      importance,
      covered: hits > 0 || listed,
      detail: hits > 0 ? `${hits} ${hits === 1 ? 'bullet' : 'bullets'}` : listed ? 'Listed in skills' : 'No evidence found yet',
    };
  };
  const requirements = [
    ...reading.required.map((label) => requirement(label, 'required')),
    ...reading.preferred.map((label) => requirement(label, 'preferred')),
  ];
  const count = (importance: 'required' | 'preferred') => ({
    covered: requirements.filter((r) => r.importance === importance && r.covered).length,
    total: requirements.filter((r) => r.importance === importance).length,
  });
  const required = count('required');
  const preferred = count('preferred');

  const traced = bullets.filter((bullet) => bullet.evidence.length > 0 && bullet.evidence.every((id) => content.evidenceRefs[id])).length;
  const claimsTraced = bullets.length ? Math.round((traced / bullets.length) * 100) : 100;
  const withFigure = bullets.filter((bullet) => /\d/.test(bullet.text)).length;

  const words = wordCount(plainText(content));
  const coverage = required.total ? required.covered / required.total : 1;
  const preferredCoverage = preferred.total ? preferred.covered / preferred.total : 1;
  const heuristic = Math.round(coverage * 60 + preferredCoverage * 15 + (claimsTraced / 100) * 25);

  const missing = requirements.filter((r) => r.importance === 'required' && !r.covered).map((r) => r.label);
  const suggestions = [
    ...(missing.length ? [`No evidence yet for ${missing.slice(0, 3).join(', ')}. Connect a source that shows it, or add an entry.`] : []),
    ...(bullets.some((bullet) => bullet.needsNumber) ? ['Some bullets imply a figure the evidence does not contain. Add the real number or keep them as they are.'] : []),
  ];

  return {
    score: input.engineScore ?? heuristic,
    required,
    preferred,
    claimsTraced,
    measurable: { withFigure, total: bullets.length },
    fitsOnePage: input.length === 'one_page' ? words <= ONE_PAGE_WORDS : null,
    requirements,
    suggestions,
  };
}
