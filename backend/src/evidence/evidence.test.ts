import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PlaceholderEngine } from '../ai/placeholder-engine';
import { makePdf } from '../test/files';
import { createTestApp, type TestApp } from '../test/harness';
import { AI_ENGINE } from '../tokens';

let ctx: TestApp;
let tolu: string;
let other: string;

// The placeholder reads sources; only CV review is replaced, because the placeholder has none.
const engine = new PlaceholderEngine();
const reviewEngine = Object.assign(Object.create(engine), {
  name: 'test-engine',
  reviewCv: async (input: { file: string | null }) => ({
    file: input.file,
    roleFamily: null,
    stats: [{ n: 4, label: 'sections' }],
    issues: [{ title: 'Add numbers', body: 'Your bullets carry no figures.', quote: 'Worked on the API' }],
    engine: 'test-engine',
  }),
});

beforeAll(async () => {
  ctx = await createTestApp({
    override: (builder) => builder.overrideProvider(AI_ENGINE).useValue(reviewEngine),
  });
  tolu = await ctx.newUser('Tolu Adebayo');
  other = await ctx.newUser('Someone Else');
});

afterAll(() => ctx.close());

const key = () => crypto.randomUUID();
const get = (path: string, user = tolu) => ctx.http().get(path).set(ctx.as(user));
const send = (method: 'post' | 'patch', path: string, body?: object, user = tolu) =>
  ctx.http()[method](path).set(ctx.as(user)).set('Idempotency-Key', key()).send(body);

const manual = (title: string, body: string, user = tolu) => send('post', '/v1/evidence', { kind: 'project', title, body }, user);

describe('manual entries', () => {
  it('adds an entry the person wrote, confirmed and tagged with the skills it names', async () => {
    const { status, body } = await manual('Payments rewrite', 'Rebuilt the payments service in TypeScript and PostgreSQL, cutting failed charges by a third.');
    expect(status).toBe(201);
    expect(body).toMatchObject({ source: 'MANUAL', title: 'Payments rewrite', pinned: false, excluded: false, edited: false, version: 1, usedInResumes: 0 });
    expect(body.skills).toEqual(expect.arrayContaining(['TypeScript', 'PostgreSQL']));
    expect(body.original).toBe(body.body);
  });

  it('does not add the same wording twice', async () => {
    const text = 'Rebuilt the payments service in TypeScript and PostgreSQL, cutting failed charges by a third.';
    const again = await manual('Payments rewrite again', text);
    const list = await get('/v1/evidence');
    expect(list.body.items.filter((item: { body: string }) => item.body === text)).toHaveLength(1);
    expect(again.body.id).toBe(list.body.items.find((item: { body: string }) => item.body === text).id);
  });

  it('refuses entries that are too short or have unknown fields', async () => {
    expect((await manual('Short', 'too short')).status).toBe(400);
    expect((await send('post', '/v1/evidence', { kind: 'project', title: 'Fine title', body: 'A long enough description of the work done.', pinned: true })).status).toBe(400);
  });
});

describe('the library', () => {
  let id: string;

  beforeAll(async () => {
    await manual('Open source CLI', 'Maintains a command-line tool for database migrations used by two hundred teams.');
    await manual('Design system', 'Led the design system used across five product teams, with accessible components.');
    id = (await get('/v1/evidence')).body.items[0].id;
  });

  it('lists newest first with counts and numbers entries by when they were collected', async () => {
    const { body } = await get('/v1/evidence');
    expect(body.items.map((item: { title: string }) => item.title)).toEqual(['Design system', 'Open source CLI', 'Payments rewrite']);
    expect(body.items.map((item: { number: number }) => item.number)).toEqual([3, 2, 1]);
    expect(body.counts).toMatchObject({ all: 3, pinned: 0, excluded: 0, duplicates: 0, edited: 0 });
    expect(body.counts.bySource.manual).toBe(3);
    expect(body.nextCursor).toBeNull();
  });

  it('searches by wording and filters by source', async () => {
    expect((await get('/v1/evidence?q=migrations')).body.items).toHaveLength(1);
    expect((await get('/v1/evidence?source=github')).body.items).toHaveLength(0);
    expect((await get('/v1/evidence?source=manual')).body.items).toHaveLength(3);
    expect((await get('/v1/evidence?show=bogus')).status).toBe(400);
  });

  it('pins, hides and edits, counting each one', async () => {
    let version = (await get('/v1/evidence')).body.items[0].version;
    const pin = await send('patch', `/v1/evidence/${id}`, { pinned: true, version });
    expect(pin.body).toMatchObject({ pinned: true, version: version + 1 });
    version = pin.body.version;

    const edit = await send('patch', `/v1/evidence/${id}`, { body: 'Led the design system used across six product teams, with accessible components.', version });
    expect(edit.body).toMatchObject({ edited: true, version: version + 1 });
    expect(edit.body.original).toBe('Led the design system used across five product teams, with accessible components.');

    const hide = await send('patch', `/v1/evidence/${id}`, { excluded: true, version: edit.body.version });
    expect(hide.body.excluded).toBe(true);

    const all = await get('/v1/evidence');
    expect(all.body.items.map((item: { id: string }) => item.id)).not.toContain(id);
    expect((await get('/v1/evidence?show=excluded')).body.items.map((item: { id: string }) => item.id)).toEqual([id]);
    expect((await get('/v1/evidence?show=pinned')).body.items).toHaveLength(1);
    expect((await get('/v1/evidence?show=edited')).body.items).toHaveLength(1);
    expect(all.body.counts).toMatchObject({ all: 2, pinned: 1, excluded: 1, edited: 1 });
  });

  it('refuses a stale edit instead of overwriting', async () => {
    const stale = await send('patch', `/v1/evidence/${id}`, { pinned: false, version: 1 });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('VERSION_CONFLICT');
  });

  it('keeps one person’s entries out of another’s reach', async () => {
    expect((await send('patch', `/v1/evidence/${id}`, { pinned: true, version: 1 }, other)).status).toBe(404);
    expect((await get('/v1/evidence', other)).body.items).toEqual([]);
  });

  it('pages through long libraries', async () => {
    const heavy = await ctx.newUser('Heavy');
    await ctx.db.query(
      `insert into public.candidate_evidence (user_id, evidence_type, claim_text, content_hash, source_provider, created_at)
       select $1, 'achievement', 'Entry number ' || g, 'hash-' || g, 'github', now() - (g || ' minutes')::interval from generate_series(1, 120) g`,
      [heavy],
    );
    const first = await get('/v1/evidence', heavy);
    expect(first.body.items).toHaveLength(50);
    expect(first.body.nextCursor).toBeTruthy();
    const second = await get(`/v1/evidence?cursor=${first.body.nextCursor}`, heavy);
    expect(second.body.items).toHaveLength(50);
    const third = await get(`/v1/evidence?cursor=${second.body.nextCursor}`, heavy);
    expect(third.body.items).toHaveLength(20);
    expect(third.body.nextCursor).toBeNull();
    const ids = [...first.body.items, ...second.body.items, ...third.body.items].map((item: { id: string }) => item.id);
    expect(new Set(ids).size).toBe(120);
    expect((await get('/v1/evidence?cursor=nonsense', heavy)).status).toBe(400);
  });
});

describe('duplicates', () => {
  let user: string;
  let pairId: string;

  beforeAll(async () => {
    user = await ctx.newUser('Dupes');
    const insert = (provider: string, text: string, hash: string) =>
      ctx.db.query<{ id: string }>(
        `insert into public.candidate_evidence (user_id, evidence_type, claim_text, content_hash, source_provider, skills)
         values ($1, 'achievement', $2, $3, $4, $5) returning id`,
        [user, text, hash, provider, provider === 'cv' ? ['Go'] : ['Docker']],
      );
    const cv = await insert('cv', 'Built a billing platform with Go and Kubernetes serving 40000 customers monthly', 'a');
    const linkedin = await insert('linkedin', 'Built a billing platform with Go and Kubernetes serving 40000 customers every month', 'b');
    const [from, to] = [cv.rows[0].id, linkedin.rows[0].id].sort();
    const relation = await ctx.db.query<{ id: string }>(
      `insert into public.evidence_relations (user_id, from_evidence_id, relation_type, to_evidence_id) values ($1, $2, 'possible_duplicate', $3) returning id`,
      [user, from, to],
    );
    pairId = relation.rows[0].id;
  });

  it('lists the pairs with both wordings', async () => {
    const { body } = await get('/v1/evidence?show=duplicates', user);
    expect(body.counts.duplicates).toBe(1);
    expect(body.duplicates).toHaveLength(1);
    expect(body.duplicates[0].id).toBe(pairId);
    expect([body.duplicates[0].a.source, body.duplicates[0].b.source].sort()).toEqual(['CV', 'LINKEDIN']);
    expect(body.items).toHaveLength(2);
  });

  it('is private to the person it belongs to', async () => {
    expect((await send('post', `/v1/evidence/duplicates/${pairId}/resolve`, { action: 'merge' }, other)).status).toBe(404);
  });

  it('keeps both when asked, and stops flagging the pair', async () => {
    const copy = await ctx.db.query<{ id: string }>(
      `insert into public.evidence_relations (user_id, from_evidence_id, relation_type, to_evidence_id)
       select user_id, from_evidence_id, 'possible_duplicate', to_evidence_id from public.evidence_relations where id = $1
       on conflict do nothing returning id`,
      [pairId],
    );
    expect(copy.rows).toHaveLength(0);
    const kept = await send('post', `/v1/evidence/duplicates/${pairId}/resolve`, { action: 'keep_both' }, user);
    expect(kept.status).toBe(200);
    const { body } = await get('/v1/evidence', user);
    expect(body.items).toHaveLength(2);
    expect(body.duplicates).toEqual([]);
  });

  it('merges onto the older entry, bringing its skills along', async () => {
    const { rows } = await ctx.db.query<{ id: string }>(`select id from public.candidate_evidence where user_id = $1 order by content_hash`, [user]);
    const [from, to] = [rows[0].id, rows[1].id].sort();
    const relation = await ctx.db.query<{ id: string }>(
      `insert into public.evidence_relations (user_id, from_evidence_id, relation_type, to_evidence_id) values ($1, $2, 'possible_duplicate', $3) returning id`,
      [user, from, to],
    );
    expect((await send('post', `/v1/evidence/duplicates/${relation.rows[0].id}/resolve`, { action: 'merge' }, user)).status).toBe(200);
    const { body } = await get('/v1/evidence', user);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].skills.sort()).toEqual(['Docker', 'Go']);
    expect(body.duplicates).toEqual([]);
  });
});

describe('finding duplicates while reading a source', () => {
  it('flags the same claim arriving from two sources, and leaves the decision to the person', async () => {
    const user = await ctx.newUser('Reader');
    const said = 'Led the migration of the monolith to services across four teams in Lagos';
    await ctx.db.query(
      `insert into public.candidate_evidence (user_id, evidence_type, claim_text, content_hash, source_provider)
       values ($1, 'achievement', $2, 'x', 'cv')`,
      [user, said],
    );
    const paste = await ctx.http().post('/v1/sources/paste').set(ctx.as(user)).set('Idempotency-Key', key()).send({ provider: 'x', text: `${said} last year.` });
    expect(paste.status).toBe(202);
    expect(await ctx.drain()).toEqual(['succeeded']);

    const { body } = await get('/v1/evidence?show=duplicates', user);
    expect(body.items).toHaveLength(2);
    expect(body.duplicates).toHaveLength(1);
    expect([body.duplicates[0].a.source, body.duplicates[0].b.source].sort()).toEqual(['CV', 'X']);
  });
});

describe('the career graph', () => {
  it('is empty for a new person', async () => {
    const fresh = await ctx.newUser();
    const { status, body } = await get('/v1/graph', fresh);
    expect(status).toBe(200);
    expect(body).toMatchObject({ entries: 0, updatedAt: null, projects: [], moreProjects: 0, skills: [] });
    expect(body.months).toHaveLength(12);
  });

  it('groups entries by project, with skills, period and the latest entries', async () => {
    const { body } = await get('/v1/graph');
    expect(body.entries).toBe(2);
    expect(body.months).toHaveLength(12);
    expect(body.months[11].count).toBe(2);
    const payments = body.projects.find((project: { name: string }) => project.name === 'Payments rewrite');
    expect(payments).toMatchObject({ count: 1, sources: 1, pinned: false, more: 0 });
    expect(payments.skills).toEqual(expect.arrayContaining(['TypeScript']));
    expect(payments.entries[0]).toMatchObject({ source: 'MANUAL' });
    expect(body.skills.map((skill: { name: string }) => skill.name)).toContain('PostgreSQL');
  });

  it('leaves hidden entries out', async () => {
    const { body } = await get('/v1/graph');
    expect(body.projects.map((project: { name: string }) => project.name)).not.toContain('Design system');
  });
});

describe('CV feedback', () => {
  it('is empty before any review', async () => {
    const response = await get('/v1/cv-reviews/latest');
    expect(response.status).toBe(200);
    expect(response.body).toBeNull();
  });

  it('asks for a CV first', async () => {
    const response = await send('post', '/v1/cv-reviews');
    expect(response.status).toBe(400);
  });

  it('reviews the uploaded CV in the background and returns the latest review', async () => {
    await ctx.http().post('/v1/sources/cv').set(ctx.as(tolu)).set('Idempotency-Key', key()).attach('file', makePdf(), { filename: 'Tolu_CV.pdf', contentType: 'application/pdf' });
    await ctx.drain();
    // The test engine reads nothing, so the CV text is stored by the parser, not by extraction.
    const start = await send('post', '/v1/cv-reviews');
    expect(start.status).toBe(202);
    expect(start.body.statusUrl).toBe(`/v1/jobs/${start.body.jobId}`);
    expect(await ctx.drain()).toEqual(['succeeded']);

    const { body } = await get('/v1/cv-reviews/latest');
    expect(body).toMatchObject({ file: 'Tolu_CV.pdf', engine: 'test-engine', stats: [{ n: 4, label: 'sections' }] });
    expect(body.issues[0]).toMatchObject({ title: 'Add numbers', quote: 'Worked on the API' });
    expect((await get('/v1/cv-reviews/latest', other)).body).toBeNull();
  });
});
