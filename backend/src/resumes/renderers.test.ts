import { describe, expect, it } from 'vitest';
import { RESUME_LENGTH, type ResumeContent } from '@tracck/shared';
import { buildMatch } from './content';
import { renderPdfMeasured } from './renderers';

describe('PDF page measurement', () => {
  it('reports actual pages when short sections overflow despite a low word count', async () => {
    const content: ResumeContent = {
      header: { name: 'Ada Obi', details: [] },
      templateId: 'classic-red',
      layout: null,
      evidenceRefs: {},
      sections: Array.from({ length: 40 }, (_, index) => ({ id: `s${index}`, heading: `Project ${index}`, kind: 'text' as const, text: 'Built software.' })),
    };
    const { buffer, pages } = await renderPdfMeasured(content);
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true, disableFontFace: true, verbosity: 0 }).promise;
    expect(pages).toBeGreaterThan(1);
    expect(pages).toBe(pdf.numPages);
    expect(buildMatch({ content, reading: { required: [], preferred: [] }, engineScore: null, length: RESUME_LENGTH.onePage, pdfPages: pages }).fitsOnePage).toBe(false);
  });
});
