import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ROLE_IDS } from '@tracck/shared';
import { createTestApp, type TestApp } from '../test/harness';
import { templateBlock } from '../ai/prompts';
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
      {
        id: 'classic-red',
        name: 'Classic red',
        description: TEMPLATES[0].description,
        previewUrl: '/v1/templates/classic-red/preview',
        isDefault: true,
        sections: TEMPLATES[0].sections.map(({ id, heading }) => ({ id, heading })),
        details: TEMPLATES[0].details,
      },
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

  it('defines every section with a purpose and the evidence it draws on', () => {
    for (const template of TEMPLATES) {
      expect(template.sections.length).toBeGreaterThan(0);
      for (const section of template.sections) {
        expect(section.purpose.length).toBeGreaterThan(20);
        expect(section.evidence.length).toBeGreaterThan(0);
      }
    }
  });

  it('gives every role a sample, and every line of it a section and an intent', () => {
    for (const template of TEMPLATES) {
      const sectionIds = new Set(template.sections.map((section) => section.id));
      for (const roleId of ROLE_IDS) {
        expect(template.samples[roleId].length).toBeGreaterThan(0);
        for (const sample of template.samples[roleId]) {
          expect(sectionIds.has(sample.section)).toBe(true);
          expect(sample.text.trim().length).toBeGreaterThan(0);
          expect(sample.intent.trim().length).toBeGreaterThan(20);
        }
      }
    }
  });
});

describe('the template in the writer prompt', () => {
  it('states each section purpose once, and every sample line with its move', () => {
    for (const template of TEMPLATES) {
      const block = templateBlock(template, 'dev');
      for (const section of template.sections) {
        expect(block.split(section.purpose).length - 1).toBe(1);
      }
      for (const sample of template.samples.dev) {
        expect(block).toContain(`move: ${sample.intent}`);
      }
    }
  });
});
