import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from '../test/harness';

let ctx: TestApp;
let user: string;
let other: string;

beforeAll(async () => {
  ctx = await createTestApp();
  user = await ctx.newUser('Lister');
  other = await ctx.newUser('Someone Else');
});

afterAll(() => ctx.close());

describe('recent background work', () => {
  it('lists the person’s own jobs, newest first, with what they are doing', async () => {
    const created = await ctx.http().post('/v1/diagnostic-jobs').set(ctx.as(user)).set('Idempotency-Key', crypto.randomUUID()).send({});
    expect(created.status).toBe(202);

    const { status, body } = await ctx.http().get('/v1/jobs').set(ctx.as(user));
    expect(status).toBe(200);
    expect(body[0]).toMatchObject({ id: created.body.jobId, type: 'diagnostic', status: 'queued', attempts: 0, error: null });
    expect(typeof body[0].createdAt).toBe('string');
  });

  it('shows nothing of anyone else’s', async () => {
    const { body } = await ctx.http().get('/v1/jobs').set(ctx.as(other));
    expect(body).toEqual([]);
  });

  it('needs a sign-in, and caps how many rows it returns', async () => {
    expect((await ctx.http().get('/v1/jobs')).status).toBe(401);
    const { body } = await ctx.http().get('/v1/jobs?limit=500').set(ctx.as(user));
    expect(body.length).toBeLessThanOrEqual(100);
  });
});
