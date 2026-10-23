// A plain word list used by the placeholder engine to tag skills and to read what
// a job asks for. It finds names that appear in the text; it infers nothing.

import type { RoleId } from '@tracck/shared';

/** Canonical name, then other spellings people write. */
const SKILLS: [string, ...string[]][] = [
  ['JavaScript', 'js', 'ecmascript'],
  ['TypeScript', 'ts'],
  ['Python'],
  ['Go', 'golang'],
  ['Java'],
  ['Kotlin'],
  ['Swift'],
  ['C#', 'csharp'],
  ['C++', 'cpp'],
  ['Rust'],
  ['PHP'],
  ['Ruby'],
  ['SQL'],
  ['React', 'reactjs'],
  ['React Native'],
  ['Next.js', 'nextjs'],
  ['Vue', 'vue.js', 'vuejs'],
  ['Angular'],
  ['Node.js', 'node', 'nodejs'],
  ['NestJS', 'nest.js'],
  ['Express', 'express.js'],
  ['Django'],
  ['Flask'],
  ['FastAPI'],
  ['Spring', 'spring boot'],
  ['Laravel'],
  ['Rails', 'ruby on rails'],
  ['Flutter'],
  ['Docker'],
  ['Kubernetes', 'k8s'],
  ['AWS'],
  ['GCP', 'google cloud'],
  ['Azure'],
  ['Terraform'],
  ['CI/CD', 'ci cd', 'continuous integration'],
  ['GitHub Actions'],
  ['Linux'],
  ['Nginx'],
  ['PostgreSQL', 'postgres'],
  ['MySQL'],
  ['MongoDB', 'mongo'],
  ['Redis'],
  ['Kafka'],
  ['RabbitMQ'],
  ['BullMQ'],
  ['Elasticsearch'],
  ['GraphQL'],
  ['REST', 'rest api', 'restful'],
  ['gRPC'],
  ['Paystack'],
  ['Stripe'],
  ['Pandas'],
  ['Tableau'],
  ['Power BI'],
  ['Excel'],
  ['Figma'],
  ['Prototyping'],
  ['User research', 'ux research'],
  ['Public speaking'],
  ['Community events', 'community building'],
  ['Mentoring'],
  ['SEO'],
  ['Content strategy', 'content marketing'],
  ['Analytics'],
  ['Customer support'],
  ['Project management'],
];

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

const matchers = SKILLS.map(([name, ...aliases]) => ({
  name,
  // Not preceded or followed by a letter or digit, so "Go" does not match "Google".
  pattern: new RegExp(`(?<![A-Za-z0-9])(?:${[name, ...aliases].map(escape).join('|')})(?![A-Za-z0-9])`, 'i'),
  // Short names that are also common words only count when written with this exact case.
  caseSensitive: ['Go', 'Java', 'Swift', 'Rust', 'Express', 'Rails', 'Spring', 'Excel', 'REST', 'Vue', 'Node.js'].includes(name),
}));

/** Skills named in the text, in the order they first appear. */
export function findSkills(text: string): string[] {
  const found: { name: string; at: number }[] = [];
  for (const matcher of matchers) {
    const source = matcher.caseSensitive ? new RegExp(matcher.pattern.source) : matcher.pattern;
    const hit = source.exec(text);
    if (hit) found.push({ name: matcher.name, at: hit.index });
  }
  return found.sort((a, b) => a.at - b.at).map((entry) => entry.name);
}

const ROLE_WORDS: Record<RoleId, string[]> = {
  dev: ['developer', 'engineer', 'backend', 'frontend', 'full-stack', 'fullstack', 'software', 'devops', 'programmer'],
  devrel: ['developer advocate', 'devrel', 'community', 'evangelist', 'developer relations', 'community lead'],
  smm: ['social media', 'community manager', 'content creator', 'brand'],
  va: ['virtual assistant', 'executive assistant', 'administrative', 'operations assistant'],
  ux: ['designer', 'ux', 'ui', 'product design', 'user experience'],
  da: ['data analyst', 'analyst', 'business intelligence', 'bi analyst', 'data science'],
};

/** The role a job title or text points to most, or null when nothing stands out. */
export function guessRole(text: string): RoleId | null {
  const lower = text.toLowerCase();
  let best: { id: RoleId; score: number } | null = null;
  for (const [id, words] of Object.entries(ROLE_WORDS) as [RoleId, string[]][]) {
    const score = words.reduce((total, word) => total + (lower.includes(word) ? 1 : 0), 0);
    if (score > 0 && (!best || score > best.score)) best = { id, score };
  }
  return best?.id ?? null;
}
