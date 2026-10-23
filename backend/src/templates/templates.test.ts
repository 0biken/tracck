import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ROLE_IDS } from '@tracck/shared';
import { createTestApp, type TestApp } from '../test/harness';
import { TEMPLATES } from './registry';

let ctx: TestApp;

beforeAll(async () => {
  ctx = await createTestApp();
});

afterAll(() => ctx.close());

describe('GET /v1/templates', () => {
  it('lists the templates with the default marked, without a sign-in', async () => {
    const { status, body } = await ctx.http().get('/v1/templates');
    expect(status).toBe(200);
    expect(body.templates).toEqual([
      { id: 'classic-red', name: 'Classic red', description: TEMPLATES[0].description, previewUrl: '/v1/templates/classic-red/preview', isDefault: true },
    ]);
  });

  it('serves the preview image of a template', async () => {
    const response = await ctx.http().get('/v1/templates/classic-red/preview');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('image/png');
  });

  it('answers 404 for a template that does not exist', async () => {
    const { status, body } = await ctx.http().get('/v1/templates/nope/preview');
    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('has a dummy example for every role, so the writer always has one to learn from', () => {
    for (const template of TEMPLATES) {
      for (const roleId of ROLE_IDS) expect(template.examples[roleId]).toMatch(/Profile:/);
    }
  });
});
