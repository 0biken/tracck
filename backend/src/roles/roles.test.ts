import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ROLES } from '@tracck/shared';
import { createTestApp, type TestApp } from '../test/harness';

let ctx: TestApp;

beforeAll(async () => {
  ctx = await createTestApp();
});

afterAll(() => ctx.close());

describe('GET /v1/roles', () => {
  it('lists the roles Tracck writes for, without a sign-in', async () => {
    const { status, body } = await ctx.http().get('/v1/roles');
    expect(status).toBe(200);
    expect(body.roles).toEqual(ROLES);
    expect(body.roles.map((role: { id: string }) => role.id)).toEqual(['dev', 'devrel', 'smm', 'va', 'ux', 'da']);
  });
});
