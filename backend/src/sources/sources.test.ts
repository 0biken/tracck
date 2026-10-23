import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { jwtVerify } from 'jose';
import { CV_LINES, makeDocx, makeLinkedinZip, makePdf } from '../test/files';
import { repo } from '../test/fakes';
import { createTestApp, type TestApp } from '../test/harness';
import { GITHUB, STORAGE } from '../tokens';
import { UnconfiguredStorage } from '../storage/storage';
import { UnconfiguredGithub } from './github.client';

let ctx: TestApp;
let tolu: string;
let other: string;

beforeAll(async () => {
  ctx = await createTestApp();
  tolu = await ctx.newUser('Tolu Adebayo');
  other = await ctx.newUser('Someone Else');
  await ctx.db.query(`update public.profiles set plan = 'pro' where id = $1`, [other]);
});

afterAll(() => ctx.close());

const key = () => crypto.randomUUID();
const get = (path: string, user = tolu) => ctx.http().get(path).set(ctx.as(user));
const post = (path: string, user = tolu, idempotency = key()) =>
  ctx.http().post(path).set(ctx.as(user)).set('Idempotency-Key', idempotency);

const evidenceFor = async (user: string) => {
  const { rows } = await ctx.db.query<{ n: number; provider: string }>(
    `select source_provider as provider, count(*)::int as n from public.candidate_evidence where user_id = $1 group by 1`,
    [user],
  );
  return Object.fromEntries(rows.map((row) => [row.provider, row.n]));
};

describe('listing', () => {
  it('needs a signed-in user and starts empty', async () => {
    expect((await ctx.http().get('/v1/sources')).status).toBe(401);
    const fresh = await ctx.newUser();
    expect((await get('/v1/sources', fresh)).body).toEqual([]);
  });
});

describe('uploading a CV', () => {
  let sourceId: string;

  it('accepts a PDF, stores it privately and starts reading it', async () => {
    const response = await post('/v1/sources/cv').attach('file', makePdf(), { filename: 'Tolu_CV_2026.pdf', contentType: 'application/pdf' });
    expect(response.status).toBe(202);
    expect(response.body).toMatchObject({ source: { provider: 'cv', name: 'CV', detail: 'Tolu_CV_2026.pdf', state: 'collecting' } });
    expect(response.body.statusUrl).toBe(`/v1/jobs/${response.body.jobId}`);
    sourceId = response.body.source.id;

    expect([...ctx.storage.objects.keys()].filter((k) => k.startsWith(`users/${tolu}/${sourceId}/`))).toHaveLength(1);
    const job = await ctx.store.get(response.body.jobId);
    expect(job).toMatchObject({ jobType: 'cv_parse', status: 'queued' });
  });

  it('reads the file into entries that keep their source, then the source reads as ready', async () => {
    expect(await ctx.drain()).toEqual(['succeeded']);

    const sources = (await get('/v1/sources')).body;
    expect(sources).toHaveLength(1);
    expect(sources[0]).toMatchObject({ id: sourceId, state: 'ready', problem: null });
    expect(sources[0].entries).toBeGreaterThanOrEqual(1);

    const { rows } = await ctx.db.query<{ claim_text: string; source_provider: string; original_text: string; skills: string[]; source_item_id: string }>(
      `select e.claim_text, e.source_provider, e.original_text, e.skills, es.source_item_id
         from public.candidate_evidence e join public.evidence_sources es on es.evidence_id = e.id where e.user_id = $1`,
      [tolu],
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((row) => row.source_provider === 'cv' && row.original_text === row.claim_text)).toBe(true);
    expect(rows.some((row) => (row.skills as string[]).includes('NestJS'))).toBe(true);

    const notice = await get('/v1/notifications');
    expect(notice.body.items.map((item: { template: string }) => item.template)).toContain('source_ready');
  });

  it('replaces the old file when the CV is uploaded again, instead of adding a second source', async () => {
    const before = await evidenceFor(tolu);
    const response = await post('/v1/sources/cv').attach('file', makeDocx(['Led a team of four building a payments dashboard in React and TypeScript for a bank client.', 'Presented the dashboard to the client every two weeks and shipped each change behind a feature flag.']), {
      filename: 'Tolu_CV_v2.docx',
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    expect(response.status).toBe(202);
    expect(response.body.source.id).toBe(sourceId);
    await ctx.drain();

    const sources = (await get('/v1/sources')).body;
    expect(sources).toHaveLength(1);
    expect(sources[0]).toMatchObject({ detail: 'Tolu_CV_v2.docx', state: 'ready' });
    const { rows } = await ctx.db.query<{ claim_text: string }>(`select claim_text from public.candidate_evidence where user_id = $1`, [tolu]);
    expect(rows.map((row) => row.claim_text).join(' ')).toContain('payments dashboard');
    expect(rows.map((row) => row.claim_text).join(' ')).not.toContain('BullMQ');
    expect(before.cv).toBeGreaterThanOrEqual(1);
  });

});

describe('upload checks', () => {
  it('judges a file by its content, not its name', async () => {
    const fake = await post('/v1/sources/cv', other).attach('file', Buffer.from('MZ not a document'), { filename: 'cv.pdf', contentType: 'application/pdf' });
    expect(fake.status).toBe(415);
    expect(fake.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');

    const zip = await post('/v1/sources/cv', other).attach('file', makeLinkedinZip(), { filename: 'cv.zip', contentType: 'application/zip' });
    expect(zip.status).toBe(415);
  });

  it('refuses an empty request and a huge file', async () => {
    expect((await post('/v1/sources/cv', other)).status).toBe(400);

    const big = await post('/v1/sources/cv', other).attach('file', Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(5 * 1024 * 1024 + 10)]), { filename: 'big.pdf' });
    expect(big.status).toBe(413);
    expect(big.body.error.code).toBe('FILE_TOO_LARGE');
  });

  it('applies a repeated request once', async () => {
    const user = await ctx.newUser();
    const idempotency = key();
    const send = () => post('/v1/sources/cv', user, idempotency).attach('file', makePdf(), { filename: 'cv.pdf' });
    const [first, second] = [await send(), await send()];
    expect(second.body.jobId).toBe(first.body.jobId);
    expect((await get('/v1/sources', user)).body).toHaveLength(1);
    expect([...ctx.storage.objects.keys()].filter((k) => k.startsWith(`users/${user}/`))).toHaveLength(1);
    expect(await ctx.drain()).toHaveLength(1);
  });

  it('answers 503 and changes nothing when file storage is not set up', async () => {
    const bare = await createTestApp({ override: (builder) => builder.overrideProvider(STORAGE).useValue(new UnconfiguredStorage()) });
    const user = await bare.newUser();
    const response = await bare.http().post('/v1/sources/cv').set(bare.as(user)).set('Idempotency-Key', key()).attach('file', makePdf(), { filename: 'cv.pdf' });
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('NOT_CONFIGURED');
    expect((await bare.http().get('/v1/sources').set(bare.as(user))).body).toEqual([]);
    await bare.close();
  });

  it('says so when a file has nothing readable in it', async () => {
    const user = await ctx.newUser();
    await post('/v1/sources/cv', user).attach('file', makePdf(['Hi']), { filename: 'scan.pdf' });
    expect(await ctx.drain()).toEqual(['failed']);
    const [source] = (await get('/v1/sources', user)).body;
    expect(source.state).toBe('problem');
    expect(source.problem).toMatch(/paste the text instead/i);
  });
});

describe('LinkedIn', () => {
  it('reads a data export into entries for each position, school and skill list', async () => {
    const user = await ctx.newUser();
    await ctx.db.query(`update public.profiles set plan = 'pro' where id = $1`, [user]);
    const response = await post('/v1/sources/linkedin', user).attach('file', makeLinkedinZip(), { filename: 'Basic_LinkedInDataExport.zip', contentType: 'application/zip' });
    expect(response.status).toBe(202);
    expect(response.body.source.name).toBe('LinkedIn data export');
    expect(await ctx.drain()).toEqual(['succeeded']);

    const { rows } = await ctx.db.query<{ title: string }>(`select title from public.candidate_evidence where user_id = $1`, [user]);
    const titles = rows.map((row) => row.title).join(' | ');
    expect(titles).toContain('Backend Developer at Lemni');
    expect(titles).toContain('Contract Developer at Logistics Co');
    expect(rows.length).toBeGreaterThanOrEqual(4);
  });

  it('reads pasted profile text', async () => {
    const user = await ctx.newUser();
    const response = await post('/v1/sources/linkedin', user).send({ text: CV_LINES.join('\n\n') });
    expect(response.status).toBe(202);
    await ctx.drain();
    expect((await evidenceFor(user)).linkedin).toBeGreaterThanOrEqual(2);
    expect((await post('/v1/sources/linkedin', user).send({ text: 'too short' })).status).toBe(400);
  });
});

describe('portfolio links and pasted text', () => {
  it('reads a public page', async () => {
    const user = await ctx.newUser();
    ctx.safeFetch.pages.set('https://tolu.dev', {
      text: '<html><head><title>Tolu Adebayo</title></head><body><h1>Tolu</h1><p>I build payment services with NestJS and Postgres for startups in Lagos and Ibadan.</p><p>Open source work includes a consistent hashing library written in Go with published benchmarks.</p></body></html>',
    });
    const response = await post('/v1/sources/portfolio', user).send({ url: 'https://tolu.dev' });
    expect(response.status).toBe(202);
    expect(await ctx.drain()).toEqual(['succeeded']);
    const { rows } = await ctx.db.query<{ claim_text: string }>(`select claim_text from public.candidate_evidence where user_id = $1 and source_provider = 'portfolio'`, [user]);
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  it('refuses a link to a private address, and the source says why', async () => {
    const user = await ctx.newUser();
    const response = await post('/v1/sources/portfolio', user).send({ url: 'http://169.254.169.254/latest/meta-data' });
    expect(response.status).toBe(202);
    expect(await ctx.drain()).toEqual(['failed']);
    const [source] = (await get('/v1/sources', user)).body;
    expect(source).toMatchObject({ state: 'problem' });
    expect(source.problem).toMatch(/public|paste/i);
  });

  it('rejects links that are not web links', async () => {
    const user = await ctx.newUser();
    expect((await post('/v1/sources/portfolio', user).send({ url: 'file:///etc/passwd' })).status).toBe(400);
    expect((await post('/v1/sources/portfolio', user).send({ url: 'javascript:alert(1)' })).status).toBe(400);
  });

  it('reads text pasted for X', async () => {
    const user = await ctx.newUser();
    const response = await post('/v1/sources/paste', user).send({ provider: 'x', text: 'Shipped v1.2.0 of our billing engine today with webhook idempotency built on Redis locks.\n\nGave a talk on queues at the Ibadan developer meetup.' });
    expect(response.status).toBe(202);
    await ctx.drain();
    expect((await evidenceFor(user)).x).toBeGreaterThanOrEqual(1);
  });
});

describe('GitHub', () => {
  let user: string;
  let state: string;
  let sourceId: string;

  beforeAll(async () => {
    user = await ctx.newUser();
    ctx.github.repos = [
      repo('lemni-billing', { description: 'Subscription billing engine for the Nigerian market.', topics: ['nestjs', 'billing'] }),
      repo('consistent-hash-go', { language: 'Go', description: 'Consistent hashing ring with virtual nodes.' }),
    ];
    ctx.github.readmes.set('toluadebayo/lemni-billing', 'Retries failed card charges through BullMQ queues backed by Postgres ledger tables.');
    ctx.github.releases.set('toluadebayo/lemni-billing', [
      { id: 7, name: 'v1.2.0', tag: 'v1.2.0', body: 'Webhook idempotency with Redis locks so a redelivered event never charges twice.', publishedAt: '2026-09-02T09:00:00Z', url: 'https://github.com/x/y/releases/7' },
    ]);
  });

  it('starts the connection with a signed state that names the person', async () => {
    const response = await post('/v1/sources/github/connect', user).send({ from: 'onboarding' });
    expect(response.status).toBe(200);
    const url = new URL(response.body.authorizeUrl);
    state = url.searchParams.get('state')!;
    const { payload } = await jwtVerify(state, new Uint8Array(Buffer.alloc(32, 7)));
    expect(payload).toMatchObject({ sub: user, from: 'onboarding' });
  });

  it('turns GitHub’s redirect into a connected, encrypted source and a job', async () => {
    const response = await ctx.http().get('/v1/sources/github/callback').query({ code: 'good-code', state }).redirects(0);
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('http://localhost:3000/onboarding/status?connected=github');

    const [source] = (await get('/v1/sources', user)).body;
    expect(source).toMatchObject({ provider: 'github', name: 'GitHub', detail: '@toluadebayo', state: 'collecting' });
    sourceId = source.id;

    const { rows } = await ctx.db.query<{ access_token_encrypted: string }>(`select access_token_encrypted from public.source_connection_secrets where connection_id = $1`, [sourceId]);
    expect(rows[0].access_token_encrypted).toMatch(/^v1:/);
    expect(rows[0].access_token_encrypted).not.toContain('gh-test-token');
  });

  it('reads public repositories and releases into entries tied to their project', async () => {
    expect(await ctx.drain()).toEqual(['succeeded']);
    const { rows } = await ctx.db.query<{ title: string; project_key: string; skills: string[]; claim_text: string }>(
      `select title, project_key, skills, claim_text from public.candidate_evidence where user_id = $1 and source_provider = 'github' order by title`,
      [user],
    );
    expect(rows.map((row) => row.project_key)).toEqual(expect.arrayContaining(['lemni-billing', 'consistent-hash-go']));
    const lemni = rows.find((row) => row.title === 'lemni-billing')!;
    expect(lemni.claim_text).toContain('BullMQ');
    expect(lemni.skills).toEqual(expect.arrayContaining(['TypeScript', 'BullMQ']));
    expect(rows.some((row) => row.claim_text.includes('Webhook idempotency'))).toBe(true);
    expect((await get('/v1/sources', user)).body[0]).toMatchObject({ state: 'ready' });
  });

  it('reading again links to the same entries instead of adding copies', async () => {
    const { rows: before } = await ctx.db.query<{ n: number }>(`select count(*)::int as n from public.candidate_evidence where user_id = $1`, [user]);
    expect((await post(`/v1/sources/${sourceId}/refresh`, user)).status).toBe(202);
    await ctx.drain();
    const { rows: after } = await ctx.db.query<{ n: number }>(`select count(*)::int as n from public.candidate_evidence where user_id = $1`, [user]);
    expect(after[0].n).toBe(before[0].n);
  });

  it('asks the person to reconnect when GitHub no longer allows access', async () => {
    ctx.github.revoked = true;
    await post(`/v1/sources/${sourceId}/retry`, user);
    expect(await ctx.drain()).toEqual(['needs_user_action']);
    const [source] = (await get('/v1/sources', user)).body;
    expect(source.state).toBe('problem');
    expect(source.problem).toMatch(/reconnect/i);
    const { rows } = await ctx.db.query<{ status: string }>(`select status from public.source_connections where id = $1`, [sourceId]);
    expect(rows[0].status).toBe('needs_reauth');
    ctx.github.revoked = false;
  });

  it('sends the person back with an error when the code or the state is wrong', async () => {
    const badCode = await ctx.http().get('/v1/sources/github/callback').query({ code: 'nope', state }).redirects(0);
    expect(badCode.headers.location).toContain('error=github');
    const badState = await ctx.http().get('/v1/sources/github/callback').query({ code: 'good-code', state: 'forged' }).redirects(0);
    expect(badState.status).toBe(302);
    expect(badState.headers.location).toContain('error=github');
    expect((await get('/v1/sources', user)).body).toHaveLength(1);
  });

  it('answers 503 when GitHub is not set up', async () => {
    const bare = await createTestApp({ override: (builder) => builder.overrideProvider(GITHUB).useValue(new UnconfiguredGithub()) });
    const lone = await bare.newUser();
    const response = await bare.http().post('/v1/sources/github/connect').set(bare.as(lone)).set('Idempotency-Key', key()).send({});
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('NOT_CONFIGURED');
    await bare.close();
  });
});

describe('removing a source', () => {
  async function withCv() {
    const user = await ctx.newUser();
    await post('/v1/sources/cv', user).attach('file', makePdf(), { filename: 'cv.pdf' });
    await ctx.drain();
    const [source] = (await get('/v1/sources', user)).body;
    return { user, id: source.id as string };
  }

  it('keeps the entries when asked, and deletes the file', async () => {
    const { user, id } = await withCv();
    const entries = (await evidenceFor(user)).cv;
    expect((await ctx.http().delete(`/v1/sources/${id}`).query({ entries: 'keep' }).set(ctx.as(user))).status).toBe(204);
    expect((await get('/v1/sources', user)).body).toEqual([]);
    expect((await evidenceFor(user)).cv).toBe(entries);
    expect([...ctx.storage.objects.keys()].some((k) => k.startsWith(`users/${user}/`))).toBe(false);
  });

  it('deletes the entries too when asked, except ones the person pinned or reworded', async () => {
    const { user, id } = await withCv();
    await ctx.db.query(`update public.candidate_evidence set pinned = true where id = (select id from public.candidate_evidence where user_id = $1 order by created_at limit 1)`, [user]);
    expect((await ctx.http().delete(`/v1/sources/${id}`).query({ entries: 'delete' }).set(ctx.as(user))).status).toBe(204);
    const { rows } = await ctx.db.query<{ pinned: boolean }>(`select pinned from public.candidate_evidence where user_id = $1`, [user]);
    expect(rows).toEqual([{ pinned: true }]);
    const free = await post('/v1/sources/portfolio', user).send({ url: 'https://tolu.dev' });
    expect(free.status).toBe(202);
  });

  it('never touches another person’s source', async () => {
    const { user, id } = await withCv();
    for (const response of [
      await ctx.http().delete(`/v1/sources/${id}`).set(ctx.as(other)),
      await post(`/v1/sources/${id}/refresh`, other),
      await post(`/v1/sources/${id}/retry`, other),
    ]) {
      expect(response.status).toBe(404);
    }
    expect((await get('/v1/sources', other)).body.map((s: { id: string }) => s.id)).not.toContain(id);
    expect((await get('/v1/sources', user)).body).toHaveLength(1);
  });

  it('rejects an id that is not an id', async () => {
    expect((await ctx.http().delete('/v1/sources/not-a-uuid').set(ctx.as(tolu))).status).toBe(400);
  });
});
