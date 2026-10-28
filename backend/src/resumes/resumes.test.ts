import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiError } from '@tracck/shared';
import { PlaceholderEngine } from '../ai/placeholder-engine';
import { createTestApp, type TestApp } from '../test/harness';
import { AI_ENGINE } from '../tokens';

const JOB = `Senior Backend Engineer
We need someone strong in TypeScript and PostgreSQL to build payment services.
Nice to have: Docker and Kubernetes experience.`;

// The placeholder writes; a switch lets a test make the writer fail.
const placeholder = new PlaceholderEngine();
const control = { fail: false };
const engine = Object.assign(Object.create(placeholder), {
  generateResume: async (input: Parameters<PlaceholderEngine['generateResume']>[0]) => {
    if (control.fail) throw new ApiError(503, 'NOT_CONFIGURED', 'Resume writing is not set up on this server yet.');
    return placeholder.generateResume(input);
  },
});

let ctx: TestApp;
let tolu: string;
let other: string;

const key = () => crypto.randomUUID();
const get = (path: string, user = tolu) => ctx.http().get(path).set(ctx.as(user));
const send = (method: 'post' | 'patch' | 'delete', path: string, body?: object, user = tolu, idempotency = key()) =>
  ctx.http()[method](path).set(ctx.as(user)).set('Idempotency-Key', idempotency).send(body);
const used = async (user: string) =>
  Number((await ctx.db.query<{ count: number }>(`select count from public.usage_counters where user_id = $1 and metric = 'resumes'`, [user])).rows[0]?.count ?? 0);

const addEvidence = async (user: string) => {
  const rows: [string, string, string[], string | null][] = [
    ['Payments API', 'Built the payments API in TypeScript and PostgreSQL, handling 40000 transactions a day.', ['TypeScript', 'PostgreSQL'], 'payments'],
    ['Deploy pipeline', 'Containerised the services with Docker and cut deploy time from 20 minutes to 4.', ['Docker'], 'platform'],
    ['Mentoring', 'Mentored three junior engineers through their first production releases.', [], null],
  ];
  for (const [index, [title, text, skills, project]] of rows.entries()) {
    await ctx.db.query(
      `insert into public.candidate_evidence (user_id, evidence_type, claim_text, title, skills, project_key, source_provider, source_where, content_hash)
       values ($1, 'achievement', $2, $3, $4, $5, 'cv', 'Tolu_CV.pdf', $6)`,
      [user, text, title, skills, project, `h-${user}-${index}`],
    );
  }
};

beforeAll(async () => {
  ctx = await createTestApp({ override: (builder) => builder.overrideProvider(AI_ENGINE).useValue(engine) });
  tolu = await ctx.newUser('Tolu Adebayo');
  other = await ctx.newUser('Someone Else');
  await ctx.db.query(`update public.profiles set location = 'Lagos, Nigeria' where id = $1`, [tolu]);
});

afterAll(() => ctx.close());

describe('reading a job', () => {
  it('needs a sign-in and a real description', async () => {
    expect((await ctx.http().post('/v1/job-descriptions/parse').send({ description: JOB })).status).toBe(401);
    expect((await send('post', '/v1/job-descriptions/parse', { description: 'too short' })).status).toBe(400);
  });

  it('finds what the job asks for, required and preferred', async () => {
    const { status, body } = await send('post', '/v1/job-descriptions/parse', { description: JOB });
    expect(status).toBe(200);
    expect(body.required).toEqual(expect.arrayContaining(['TypeScript', 'PostgreSQL']));
    expect(body.preferred).toEqual(expect.arrayContaining(['Docker', 'Kubernetes']));
  });
});

describe('starting a resume', () => {
  const body = { jobDescription: JOB, company: 'Paystack', length: 'one_page' };

  it('asks for consent first, then for something to write from', async () => {
    const refused = await send('post', '/v1/resumes', body);
    expect(refused.status).toBe(403);
    expect(refused.body.error.code).toBe('CONSENT_REQUIRED');

    await send('post', '/v1/me/consents/policy');
    const empty = await send('post', '/v1/resumes', body);
    expect(empty.status).toBe(422);
    expect(await used(tolu)).toBe(0);
  });

});

describe('writing and reading a resume', () => {
  let resumeId: string;
  let jobId: string;
  const idempotency = key();

  beforeAll(() => addEvidence(tolu));

  it('accepts the request, counts it once, and answers the same to a repeat', async () => {
    const first = await send('post', '/v1/resumes', { jobDescription: JOB, company: 'Paystack', focus: 'payments', length: 'one_page' }, tolu, idempotency);
    expect(first.status).toBe(202);
    expect(first.body.statusUrl).toBe(`/v1/jobs/${first.body.jobId}`);
    resumeId = first.body.resumeId;
    jobId = first.body.jobId;

    const before = await used(tolu);
    const unknown = await send('post', '/v1/resumes', { jobDescription: JOB, length: 'one_page', templateId: 'nope' }, tolu, key());
    expect(unknown.status).toBe(422);
    expect(await used(tolu)).toBe(before);

    const again = await send('post', '/v1/resumes', { jobDescription: JOB, company: 'Paystack', focus: 'payments', length: 'one_page' }, tolu, idempotency);
    expect(again.status).toBe(202);
    expect(again.body).toMatchObject({ resumeId, jobId });
    expect(await used(tolu)).toBe(1);
    expect((await get('/v1/resumes')).body.items).toHaveLength(1);
  });

  it('shows it as being written until the job has run', async () => {
    const { body } = await get(`/v1/resumes/${resumeId}`);
    expect(body).toMatchObject({ status: 'generating', content: null, match: null, jobId, company: 'Paystack', version: 0 });
    expect((await get('/v1/resumes?status=generating')).body.items).toHaveLength(1);
  });

  it('writes a draft from the person’s own entries, each bullet tracing to one', async () => {
    expect(await ctx.drain()).toEqual(['succeeded']);
    const { body } = await get(`/v1/resumes/${resumeId}`);
    expect(body).toMatchObject({ status: 'draft', version: 1, engine: 'placeholder', jobId: null, length: 'one_page', job: { focus: 'payments' } });
    // The classic-red header shows the personal details that template lists, and only those.
    expect(body.content.header).toEqual({ name: 'Tolu Adebayo', details: [{ label: 'Email address', value: `${tolu}@example.com` }] });
    expect(body.content).toMatchObject({ templateId: 'classic-red' });
    expect(body.content).not.toHaveProperty('person');
    expect(body.content.layout).not.toHaveProperty('templateId');

    const bullets = body.content.sections.flatMap((s: { groups?: { bullets: { id: string; text: string; evidence: string[] }[] }[] }) => (s.groups ?? []).flatMap((g) => g.bullets));
    expect(bullets.length).toBeGreaterThan(0);
    for (const bullet of bullets) {
      expect(bullet.evidence.length).toBeGreaterThan(0);
      for (const id of bullet.evidence) expect(body.content.evidenceRefs[id].original).toContain(bullet.text.replace(/\.$/, '').slice(0, 20));
    }
    // The entry that names the job's skills comes first.
    expect(bullets[0].text).toContain('payments API');
  });

  it('reports what the draft covers of the job', async () => {
    const { match } = (await get(`/v1/resumes/${resumeId}`)).body;
    expect(match.required).toEqual({ covered: 2, total: 2 });
    expect(match.preferred.total).toBe(2);
    expect(match.preferred.covered).toBe(1);
    expect(match.claimsTraced).toBe(100);
    expect(match.measurable.withFigure).toBeGreaterThan(0);
    expect(match.requirements.find((r: { label: string }) => r.label === 'Kubernetes')).toMatchObject({ covered: false, detail: 'No evidence found yet' });
    expect(match.suggestions.join(' ')).not.toMatch(/TypeScript/);
  });

  it('lists, searches and filters', async () => {
    const list = await get('/v1/resumes');
    expect(list.body.items[0]).toMatchObject({ id: resumeId, company: 'Paystack', status: 'draft', jobId: null });
    expect((await get('/v1/resumes?q=paystack')).body.items).toHaveLength(1);
    expect((await get('/v1/resumes?q=nothing')).body.items).toHaveLength(0);
    expect((await get('/v1/resumes?status=exported')).body.items).toHaveLength(0);
    expect((await get('/v1/resumes?status=bogus')).status).toBe(400);
  });

  it('keeps it private to its owner', async () => {
    expect((await get(`/v1/resumes/${resumeId}`, other)).status).toBe(404);
    expect((await get(`/v1/resumes/${resumeId}/versions`, other)).status).toBe(404);
    expect((await send('delete', `/v1/resumes/${resumeId}`, undefined, other)).status).toBe(404);
    expect((await get('/v1/resumes', other)).body.items).toEqual([]);
    expect((await get('/v1/resumes/not-a-uuid')).status).toBe(400);
  });

  it('counts entries added since the draft', async () => {
    await ctx.db.query(
      `insert into public.candidate_evidence (user_id, evidence_type, claim_text, content_hash, source_provider) values ($1, 'achievement', 'A new thing happened here in the record', 'later', 'manual')`,
      [tolu],
    );
    expect((await get('/v1/resumes')).body.items[0].newEntries).toBe(1);
  });

  describe('editing', () => {
    let bulletId: string;
    let version = 1;
    const bullets = async () => {
      const { body } = await get(`/v1/resumes/${resumeId}`);
      return body.content.sections[0].groups.flatMap((g: { bullets: { id: string; text: string }[] }) => g.bullets) as { id: string; text: string; needsNumber?: boolean }[];
    };

    it('rewords a bullet as a new version, keeping the old one', async () => {
      bulletId = (await bullets())[0].id;
      const { status, body } = await send('patch', `/v1/resumes/${resumeId}/bullets/${bulletId}`, { text: 'Built and ran the payments API for two million customers.', version });
      expect(status).toBe(200);
      expect(body.version).toBe(2);
      version = 2;
      expect((await bullets())[0].text).toBe('Built and ran the payments API for two million customers.');
      const versions = (await get(`/v1/resumes/${resumeId}/versions`)).body;
      expect(versions.map((v: { number: number; createdBy: string }) => [v.number, v.createdBy])).toEqual([[2, 'user'], [1, 'ai']]);
    });

    it('refuses an edit made from an older version', async () => {
      const stale = await send('patch', `/v1/resumes/${resumeId}/bullets/${bulletId}`, { text: 'Something else entirely here.', version: 1 });
      expect(stale.status).toBe(409);
      expect(stale.body.error.code).toBe('VERSION_CONFLICT');
    });

    it('adds a figure the person supplies', async () => {
      const { body } = await send('patch', `/v1/resumes/${resumeId}/bullets/${bulletId}`, { figure: 'serving 40 banks', version });
      version = body.version;
      expect((await bullets())[0].text).toBe('Built and ran the payments API for two million customers, serving 40 banks.');
    });

    it('refuses empty edits and unknown bullets', async () => {
      expect((await send('patch', `/v1/resumes/${resumeId}/bullets/${bulletId}`, { version })).status).toBe(400);
      expect((await send('patch', `/v1/resumes/${resumeId}/bullets/nope`, { text: 'Some other wording here', version })).status).toBe(404);
    });

    it('moves a bullet up within its group, and refuses when it is already first', async () => {
      const list = await bullets();
      const group = (await get(`/v1/resumes/${resumeId}`)).body.content.sections[0].groups.find((g: { bullets: unknown[] }) => g.bullets.length > 1);
      if (!group) return;
      const second = group.bullets[1];
      const moved = await send('post', `/v1/resumes/${resumeId}/bullets/${second.id}/move`, { version });
      expect(moved.status).toBe(200);
      version = moved.body.version;
      expect((await send('post', `/v1/resumes/${resumeId}/bullets/${second.id}/move`, { version })).status).toBe(400);
      expect(list.length).toBeGreaterThan(0);
    });

    it('removes a bullet, and brings it back by restoring the version before', async () => {
      const before = await bullets();
      const removed = await ctx.http().delete(`/v1/resumes/${resumeId}/bullets/${before[0].id}?version=${version}`).set(ctx.as(tolu));
      expect(removed.status).toBe(200);
      expect((await bullets()).map((b) => b.id)).not.toContain(before[0].id);

      const restored = await send('post', `/v1/resumes/${resumeId}/restore`, { version });
      expect(restored.status).toBe(200);
      expect((await bullets()).map((b) => b.id)).toContain(before[0].id);
      version = restored.body.version;
      expect((await send('post', `/v1/resumes/${resumeId}/restore`, { version: 99 })).status).toBe(404);
    });
  });

  describe('exporting', () => {
    it('makes a real PDF in private storage and hands out a short-lived link', async () => {
      expect((await get(`/v1/resumes/${resumeId}/export/pdf`)).status).toBe(404);
      const start = await send('post', `/v1/resumes/${resumeId}/export`, { format: 'pdf' });
      expect(start.status).toBe(202);
      expect(await ctx.drain()).toEqual(['succeeded']);

      const link = await get(`/v1/resumes/${resumeId}/export/pdf`);
      expect(link.status).toBe(200);
      expect(new Date(link.body.expiresAt).getTime()).toBeGreaterThan(Date.now());
      const key = [...ctx.storage.objects.keys()].find((k) => k.endsWith('.pdf') && k.includes(resumeId))!;
      expect(key).toContain(`users/${tolu}/resumes/${resumeId}/`);
      expect(ctx.storage.objects.get(key)!.body.subarray(0, 5).toString()).toBe('%PDF-');

      const detail = (await get(`/v1/resumes/${resumeId}`)).body;
      expect(detail.exports).toEqual({ pdf: true, docx: false });
      expect(detail.status).toBe('exported');
      expect((await get('/v1/resumes?status=exported')).body.items).toHaveLength(1);
    });

    it('keeps Word export for Pro, and the link private to the owner', async () => {
      const refused = await send('post', `/v1/resumes/${resumeId}/export`, { format: 'docx' });
      expect(refused.status).toBe(402);
      expect(refused.body.error.code).toBe('PLAN_LIMIT_REACHED');
      expect((await get(`/v1/resumes/${resumeId}/export/pdf`, other)).status).toBe(404);
      expect((await get(`/v1/resumes/${resumeId}/export/txt`)).status).toBe(400);
    });

    it('makes a Word file for a Pro user', async () => {
      await ctx.db.query(`update public.profiles set plan = 'pro' where id = $1`, [tolu]);
      expect((await send('post', `/v1/resumes/${resumeId}/export`, { format: 'docx' })).status).toBe(202);
      expect(await ctx.drain()).toEqual(['succeeded']);
      const key = [...ctx.storage.objects.keys()].find((k) => k.endsWith('.docx'))!;
      expect(ctx.storage.objects.get(key)!.body.subarray(0, 2).toString()).toBe('PK');
      expect((await get(`/v1/resumes/${resumeId}`)).body.exports).toEqual({ pdf: true, docx: true });
      await ctx.db.query(`update public.profiles set plan = 'free' where id = $1`, [tolu]);
    });
  });

  describe('writing again', () => {
    it('adds a new version from the latest record and counts against the month', async () => {
      const before = await used(tolu);
      const start = await send('post', `/v1/resumes/${resumeId}/regenerate`);
      expect(start.status).toBe(202);
      expect((await get(`/v1/resumes/${resumeId}`)).body.status).toBe('generating');
      expect((await send('patch', `/v1/resumes/${resumeId}/bullets/b1`, { text: 'Edit while writing here.', version: 1 })).status).toBe(409);
      expect(await ctx.drain()).toEqual(['succeeded']);
      expect(await used(tolu)).toBe(before + 1);
      const detail = (await get(`/v1/resumes/${resumeId}`)).body;
      expect(detail.status).toBe('exported');
      expect((await get(`/v1/resumes/${resumeId}/versions`)).body[0].createdBy).toBe('ai');
      expect(detail.version).toBeGreaterThan(2);
    });
  });
});

describe('when writing fails', () => {
  it('gives the resume back for the month, marks it failed, and keeps the person’s time', async () => {
    const user = await ctx.newUser('Unlucky');
    await send('post', '/v1/me/consents/policy', undefined, user);
    await addEvidence(user);
    control.fail = true;
    try {
      const start = await send('post', '/v1/resumes', { jobDescription: JOB, length: 'one_page' }, user);
      expect(start.status).toBe(202);
      expect(await used(user)).toBe(1);
      expect(await ctx.drain()).toEqual(['failed']);

      expect(await used(user)).toBe(0);
      const detail = (await get(`/v1/resumes/${start.body.resumeId}`, user)).body;
      expect(detail).toMatchObject({ status: 'failed', content: null });
      const job = await ctx.store.get(start.body.jobId);
      expect(job).toMatchObject({ status: 'failed', errorCode: 'NOT_CONFIGURED' });
    } finally {
      control.fail = false;
    }
  });
});

describe('deleting', () => {
  it('removes one resume with its files, and then everything', async () => {
    const user = await ctx.newUser('Tidy');
    await send('post', '/v1/me/consents/policy', undefined, user);
    await addEvidence(user);
    const first = await send('post', '/v1/resumes', { jobDescription: JOB, length: 'one_page' }, user);
    await send('post', '/v1/resumes', { jobDescription: `${JOB}\nSecond.`, length: 'one_page' }, user);
    await ctx.drain();
    await send('post', `/v1/resumes/${first.body.resumeId}/export`, { format: 'pdf' }, user);
    await ctx.drain();
    expect([...ctx.storage.objects.keys()].some((k) => k.startsWith(`users/${user}/resumes/${first.body.resumeId}/`))).toBe(true);

    expect((await send('delete', `/v1/resumes/${first.body.resumeId}`, undefined, user)).status).toBe(204);
    expect([...ctx.storage.objects.keys()].some((k) => k.includes(first.body.resumeId))).toBe(false);
    expect((await get(`/v1/resumes/${first.body.resumeId}`, user)).status).toBe(404);
    expect((await get('/v1/resumes', user)).body.items).toHaveLength(1);

    expect((await send('delete', '/v1/resumes', undefined, user)).status).toBe(204);
    expect((await get('/v1/resumes', user)).body.items).toEqual([]);
    const { rows } = await ctx.db.query<{ n: number }>(`select count(*)::int as n from public.target_opportunities where user_id = $1`, [user]);
    expect(rows[0].n).toBe(0);
    // The person’s record is untouched.
    expect((await get('/v1/evidence', user)).body.counts.all).toBe(3);
  });
});
