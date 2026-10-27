import { createHash } from 'node:crypto';
import { drizzle } from 'drizzle-orm/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ApiEnv } from '../config/env';
import * as schema from '../db/schema';
import { EMBEDDING_DIMENSIONS } from '../db/schema';
import { createTestDatabase, createTestUser, type PGlite } from '../testing';
import type { Database } from '../db';
import type { EvidenceCandidate, GenerateInput } from './ai-engine';
import { ContextService } from './context.service';
import { ExampleStore } from './examples';
import { EXAMPLE_SEEDS } from './examples-seed';
import { GeminiEngine } from './gemini-engine';
import { emptyUsage, type EmbedRequest, type JsonRequest, type LlmClient } from './llm';
import { PlaceholderEngine } from './placeholder-engine';
import { layoutChoiceSchema } from './schemas';
import { numbersIn, verifyBullet, type PoolEntry } from './verify';

const DIMENSIONS = EMBEDDING_DIMENSIONS;

/** A bag-of-words embedding: texts that share words are close, so retrieval is testable without a model. */
function embedText(text: string): number[] {
  const vector = new Array<number>(DIMENSIONS).fill(0);
  for (const word of text.toLowerCase().match(/[a-z0-9+#.]{3,}/g) ?? []) {
    const slot = createHash('md5').update(word).digest().readUInt16BE(0) % DIMENSIONS;
    vector[slot] += 1;
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / norm);
}

type Responder = (request: JsonRequest<unknown>) => unknown;

type FakeResponders = Partial<Record<JsonRequest<unknown>['purpose'] | 'format', Responder>>;

class FakeLlm implements LlmClient {
  readonly calls: JsonRequest<unknown>[] = [];
  embedCalls = 0;
  /** The formatter also uses the write purpose, so it has a responder of its own. */
  private readonly responders: FakeResponders;

  constructor(responders: FakeResponders = {}) {
    this.responders = { format: () => ({ experienceGroupIds: [], educationGroupIds: [], skills: [], strengths: [] }), ...responders };
  }

  async json<T>(request: JsonRequest<T>) {
    this.calls.push(request as JsonRequest<unknown>);
    const respond = (request.schema as unknown) === layoutChoiceSchema ? this.responders.format : this.responders[request.purpose];
    if (!respond) throw new Error(`no fake answer for ${request.purpose}`);
    return { data: request.schema.parse(respond(request as JsonRequest<unknown>)), usage: emptyUsage() };
  }

  async embed(request: EmbedRequest) {
    this.embedCalls += 1;
    return request.texts.map(embedText);
  }
}

const env = {
  AI_WRITER_MODEL: 'writer',
  AI_CRITIC_MODEL: 'critic',
  AI_EXTRACT_MODEL: 'extract',
  AI_EMBEDDING_MODEL: 'fake-embedding',
  AI_WRITER_THINKING: 'off',
  AI_CRITIC_THINKING: 'off',
  AI_MAX_REVISIONS: 2,
  AI_EVIDENCE_LIMIT: 40,
} as ApiEnv;

describe('verifyBullet', () => {
  const pool = new Map<string, PoolEntry>([
    ['E1', { ref: 'E1', id: 'id-1', text: 'Built a billing API in TypeScript and PostgreSQL handling 12,000 requests a day', skills: ['TypeScript', 'PostgreSQL'] }],
  ]);
  const check = (text: string, evidence = ['E1']) => verifyBullet({ id: 'b1', text, evidence }, pool).filter((f) => f.severity === 'blocking').map((f) => f.kind);

  it('accepts a bullet whose figures and tools are in the evidence', () => {
    expect(check('Built a billing API in TypeScript serving 12000 requests daily.')).toEqual([]);
  });

  it('rejects an invented figure', () => {
    expect(check('Built a billing API handling 300% more traffic.')).toEqual(['unsupported_number']);
  });

  it('rejects a tool the evidence does not name', () => {
    expect(check('Built a billing API with Kubernetes.')).toEqual(['unsupported_skill']);
  });

  it('rejects a bullet with no citation, or one that cites an unknown entry', () => {
    expect(check('Built a billing API.', [])).toEqual(['no_evidence']);
    expect(check('Built a billing API.', ['E9'])).toEqual(['unknown_evidence', 'no_evidence']);
  });

  it('treats 10k and 10,000 as the same figure', () => {
    expect(numbersIn('10k users')).toEqual(numbersIn('10,000 users'));
  });
});

describe('database retrieval', () => {
  let pg: PGlite;
  let db: Database;
  let userId: string;
  let other: string;
  let context: ContextService;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    pg = await createTestDatabase();
    db = drizzle(pg, { schema }) as unknown as Database;
    userId = await createTestUser(pg);
    other = await createTestUser(pg, 'Someone Else');
    const llm = new FakeLlm();
    context = new ContextService(db, env, llm);

    const add = async (owner: string, key: string, values: Partial<typeof schema.candidateEvidence.$inferInsert> & { claimText: string }) => {
      const [row] = await db
        .insert(schema.candidateEvidence)
        .values({ userId: owner, evidenceType: 'project', sourceProvider: 'github', ...values })
        .returning({ id: schema.candidateEvidence.id });
      ids[key] = row.id;
    };
    await add(userId, 'api', { title: 'Billing API', claimText: 'Built a billing API in TypeScript and PostgreSQL', skills: ['TypeScript', 'PostgreSQL'], topics: ['performance'] });
    await add(userId, 'talk', { title: 'Meetup talk', claimText: 'Organised community meetups for 300 attendees', skills: [], topics: ['leadership'], sourceProvider: 'linkedin' });
    await add(userId, 'hidden', { title: 'Hidden', claimText: 'Built a billing API in TypeScript', excluded: true });
    await add(userId, 'rejected', { title: 'Rejected', claimText: 'Built a billing API in TypeScript', verificationStatus: 'rejected' });
    await add(userId, 'pinned', { title: 'Pinned award', claimText: 'Won a regional hackathon', pinned: true });
    await add(other, 'theirs', { title: 'Their API', claimText: 'Built a billing API in TypeScript and PostgreSQL', skills: ['TypeScript'] });
    await context.index(userId);
    await context.index(other);
  });

  afterAll(async () => {
    await pg.close();
  });

  it('embeds each entry once and only re-embeds what changed', async () => {
    expect((await context.index(userId)).embedded).toBe(0);
    await db.update(schema.candidateEvidence).set({ claimText: 'Built a payments API in TypeScript and PostgreSQL' }).where(eqId(ids.api));
    expect((await context.index(userId)).embedded).toBe(1);
  });

  it('ranks the entries that match the job first', async () => {
    const found = await context.retrieve({ userId, query: 'TypeScript PostgreSQL API developer', tags: ['TypeScript'] });
    const order = found.map((entry) => entry.id);
    expect(order.indexOf(ids.api)).toBeLessThan(order.indexOf(ids.talk));
  });

  it("never returns excluded, rejected or another person's entries", async () => {
    const found = (await context.retrieve({ userId, query: 'billing API TypeScript', tags: [] })).map((entry) => entry.id);
    expect(found).not.toContain(ids.hidden);
    expect(found).not.toContain(ids.rejected);
    expect(found).not.toContain(ids.theirs);
  });

  it('always includes pinned entries, even when nothing about them matches', async () => {
    const found = (await context.retrieve({ userId, query: 'TypeScript PostgreSQL API developer', tags: ['typescript'], limit: 5 })).map((e) => e.id);
    expect(found).toContain(ids.pinned);
  });

  it('can be steered by an emphasis tag', async () => {
    const found = await context.retrieve({ userId, query: 'community meetups', tags: ['leadership'] });
    expect(found[0].id === ids.pinned ? found[1].id : found[0].id).toBe(ids.talk);
  });

  it('limits to chosen source providers', async () => {
    const found = await context.retrieve({ userId, query: 'meetups TypeScript', tags: [], providers: ['linkedin'] });
    expect(found.map((entry) => entry.id)).toEqual([ids.talk]);
  });

  it('serves few-shot examples for a role', async () => {
    await db.insert(schema.resumeExamples).values([
      { roleFamily: 'dev', seniority: 'all', exampleKind: 'good', exampleContentJson: EXAMPLE_SEEDS.dev.good as never, rightsStatus: 'synthetic' },
      { roleFamily: 'dev', seniority: 'all', exampleKind: 'annotated_bad', exampleContentJson: { rewrites: EXAMPLE_SEEDS.dev.rewrites } as never, rightsStatus: 'synthetic' },
    ]);
    const set = await new ExampleStore(db).forRole('dev', null);
    expect(set.good).toHaveLength(1);
    expect(set.rewrites).toHaveLength(2);
    expect((await new ExampleStore(db).forRole('smm', null)).good).toHaveLength(0);
  });
});

function eqId(id: string) {
  return sqlEq(schema.candidateEvidence.id, id);
}
import { eq as sqlEq } from 'drizzle-orm';

describe('GeminiEngine.generateResume', () => {
  const evidence: EvidenceCandidate[] = [
    { id: 'ev-1', title: 'Billing API', claimText: 'Built a billing API in TypeScript and PostgreSQL handling 12,000 requests a day', skills: ['TypeScript', 'PostgreSQL'], topics: ['performance'], projectKey: null, source: 'GITHUB', where: 'acme/billing', date: '2024-03-01', pinned: false },
    { id: 'ev-2', title: 'Meetups', claimText: 'Organised monthly meetups for 300 attendees', skills: [], topics: [], projectKey: null, source: 'CV', where: null, date: null, pinned: false },
  ];
  const input: GenerateInput = {
    person: { name: 'Ada Obi', email: 'ada@example.com', phone: null, location: null, address: null, dateOfBirth: null, nationality: null },
    job: { title: 'Backend Developer', company: 'Acme', description: 'Build APIs in TypeScript.', required: ['TypeScript'], preferred: [], roleId: 'dev' },
    focus: null,
    instructions: null,
    length: 'one_page',
    roleId: 'dev',
    templateId: 'classic-red',
    evidence,
  };
  const draftWith = (bullets: { text: string; evidence: string[] }[]) => ({
    summary: 'Backend developer.',
    skills: ['TypeScript', 'Rust'],
    sections: [{ heading: 'Projects', groups: [{ title: 'Billing', bullets }] }],
  });
  const pass = { verdict: 'pass', score: 88, issues: [], uncoveredRequirements: [] };

  const engineWith = (llm: FakeLlm, overrides: Partial<ApiEnv> = {}) =>
    new GeminiEngine({ ...env, ...overrides }, llm, { forRole: async () => ({ good: [], rewrites: [] }) } as unknown as ExampleStore, new PlaceholderEngine());

  it('writes a resume whose bullets all trace to evidence, and drops unsupported skills', async () => {
    const llm = new FakeLlm({
      write: () => draftWith([{ text: 'Built a billing API in TypeScript serving 12,000 requests a day.', evidence: ['E1'] }]),
      check: () => pass,
    });
    const draft = await engineWith(llm).generateResume(input);

    const groups = draft.content.sections.find((s) => s.heading === 'Projects');
    expect(groups?.kind).toBe('groups');
    expect(draft.usedEvidenceIds).toEqual(['ev-1']);
    expect(draft.content.evidenceRefs['ev-1'].original).toContain('12,000');
    const skills = draft.content.sections.find((s) => s.heading === 'Skills');
    expect(skills && 'text' in skills && skills.text).toBe('TypeScript');
    expect(draft.review).toMatchObject({ score: 88, revisions: 0, removedBullets: 0 });
    expect(llm.calls.map((c) => c.purpose)).toEqual(['write', 'check', 'write']);
  });

  it('lets the formatter choose layout ids, dropping any the resume does not have', async () => {
    const llm = new FakeLlm({
      write: () => draftWith([{ text: 'Built a billing API in TypeScript.', evidence: ['E1'] }]),
      check: () => pass,
      format: () => ({ experienceGroupIds: ['g1', 'g9'], educationGroupIds: [], skills: ['typescript', 'Rust'], strengths: ['performance', 'invented'] }),
    });
    const draft = await engineWith(llm).generateResume(input);
    expect(draft.content.layout).toEqual({
      templateId: 'classic-red',
      experienceGroupIds: ['g1'],
      educationGroupIds: [],
      skills: [{ name: 'TypeScript', level: 1 }],
      strengths: ['Performance'],
    });
    expect(draft.content.templateId).toBe('classic-red');
    expect(draft.content.person).toEqual(input.person);
  });

  it('sends an invented figure back to the writer and keeps the corrected bullet', async () => {
    let writes = 0;
    const llm = new FakeLlm({
      write: (request) => {
        writes += 1;
        if (writes === 1) return draftWith([{ text: 'Built a billing API that cut costs by 40%.', evidence: ['E1'] }]);
        expect(request.prompt).toContain('40%');
        return draftWith([{ text: 'Built a billing API in TypeScript and PostgreSQL.', evidence: ['E1'] }]);
      },
      check: () => pass,
    });
    const draft = await engineWith(llm).generateResume(input);
    expect(writes).toBe(2);
    expect(draft.review).toMatchObject({ revisions: 1, removedBullets: 0 });
    expect(JSON.stringify(draft.content)).not.toContain('40%');
  });

  it('removes a bullet that is still unsupported when the revision budget runs out', async () => {
    const llm = new FakeLlm({
      write: () =>
        draftWith([
          { text: 'Grew revenue by 900%.', evidence: ['E1'] },
          { text: 'Organised monthly meetups for 300 attendees.', evidence: ['E2'] },
        ]),
      check: () => ({ verdict: 'revise', score: 40, issues: [{ bullet: 'b1', kind: 'unsupported', reason: 'no source', fix: 'remove it' }], uncoveredRequirements: ['TypeScript'] }),
    });
    const draft = await engineWith(llm, { AI_MAX_REVISIONS: 1 }).generateResume(input);
    const text = JSON.stringify(draft.content);
    expect(text).not.toContain('900%');
    expect(text).toContain('meetups');
    expect(draft.review).toMatchObject({ revisions: 1, removedBullets: 1, uncoveredRequirements: ['TypeScript'] });
  });

  it('skips the critic entirely when revisions are set to 0', async () => {
    const llm = new FakeLlm({ write: () => draftWith([{ text: 'Built a billing API in TypeScript.', evidence: ['E1'] }]) });
    const draft = await engineWith(llm, { AI_MAX_REVISIONS: 0 }).generateResume(input);
    expect(llm.calls.map((c) => c.purpose)).toEqual(['write', 'write']);
    expect(draft.review?.score).toBeNull();
  });

  it('keeps writer and critic models and thinking settings separate', async () => {
    const llm = new FakeLlm({
      write: () => draftWith([{ text: 'Built a billing API in TypeScript.', evidence: ['E1'] }]),
      check: () => pass,
    });
    await engineWith(llm, { AI_WRITER_THINKING: 'high', AI_CRITIC_THINKING: 'low' }).generateResume(input);
    expect(llm.calls.map((c) => [c.model, c.thinking])).toEqual([
      ['writer', 'high'],
      ['critic', 'low'],
      ['writer', undefined],
    ]);
  });

  it('puts the stable prompt text in the system message so it can be cached', async () => {
    const llm = new FakeLlm({ write: () => draftWith([{ text: 'Built a billing API in TypeScript.', evidence: ['E1'] }]), check: () => pass });
    await engineWith(llm).generateResume(input);
    const write = llm.calls[0];
    expect(write.system).toContain('Hard rules');
    expect(write.system).not.toContain('Ada Obi');
    expect(write.prompt).toContain('Ada Obi');
  });

  it('refuses to write from no evidence', async () => {
    await expect(engineWith(new FakeLlm()).generateResume({ ...input, evidence: [] })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

describe('GeminiEngine reading', () => {
  it('falls back to the plain reader when the model fails', async () => {
    const llm = new FakeLlm({ extract: () => { throw new Error('model down'); } });
    const engine = new GeminiEngine(env, llm, {} as ExampleStore, new PlaceholderEngine());
    const entries = await engine.extractEvidence({
      id: 'd', provider: 'CV' as never, kind: 'uploaded_cv', title: null, url: null, date: null, where: null,
      text: 'Built a billing service in TypeScript and PostgreSQL that handles 12,000 requests a day for three clients.',
    });
    expect(entries.length).toBeGreaterThan(0);
  });

  it('keeps only quotes that are really in the CV', async () => {
    const llm = new FakeLlm({
      check: () => ({
        stats: [{ n: 2, label: 'bullets with a figure' }],
        issues: [
          { title: 'Vague', body: 'No result.', quote: 'Worked on stuff', fix: 'Add a result.' },
          { title: 'Made up', body: 'x', quote: 'This sentence is not in the CV' },
        ],
      }),
    });
    const review = await new GeminiEngine(env, llm, {} as ExampleStore, new PlaceholderEngine()).reviewCv({ text: 'Worked on stuff at Acme.', file: 'cv.pdf', roleId: 'dev' });
    expect(review.issues[0].quote).toBe('Worked on stuff');
    expect(review.issues[1].quote).toBeUndefined();
  });
});
