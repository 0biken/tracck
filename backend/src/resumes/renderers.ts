// Plain, single-column documents: real text in reading order, standard fonts, no
// tables, columns or images, so applicant tracking systems read them correctly.

import { AlignmentType, Document, HeadingLevel, LevelFormat, Packer, Paragraph, TextRun } from 'docx';
import PDFDocument from 'pdfkit';
import type { ResumeContent } from '@tracck/shared';

const MARGIN = 54;

export function renderPdf(content: ResumeContent): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN }, info: { Title: `${content.header.name} resume`, Author: content.header.name } });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.font('Helvetica-Bold').fontSize(20).text(content.header.name);
    if (content.header.contact) doc.font('Helvetica').fontSize(10).fillColor('#444444').text(content.header.contact);
    doc.fillColor('#000000').moveDown(0.8);

    for (const section of content.sections) {
      doc.font('Helvetica-Bold').fontSize(11).text(section.heading.toUpperCase(), { characterSpacing: 0.6 });
      const y = doc.y + 1;
      doc.moveTo(MARGIN, y).lineTo(doc.page.width - MARGIN, y).lineWidth(0.5).strokeColor('#000000').stroke();
      doc.moveDown(0.4);

      if (section.kind === 'text') {
        doc.font('Helvetica').fontSize(10.5).text(section.text, { lineGap: 2 });
      } else {
        for (const group of section.groups) {
          if (group.title) {
            doc.font('Helvetica-Bold').fontSize(10.5).text([group.title, group.year].filter(Boolean).join('  ·  '), { lineGap: 2 });
          }
          for (const bullet of group.bullets) {
            doc.font('Helvetica').fontSize(10.5).text(`•  ${bullet.text}`, { indent: 0, lineGap: 2, paragraphGap: 2 });
          }
          doc.moveDown(0.3);
        }
      }
      doc.moveDown(0.6);
    }
    doc.end();
  });
}

export async function renderDocx(content: ResumeContent): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({ children: [new TextRun({ text: content.header.name, bold: true, size: 40 })] }),
  ];
  if (content.header.contact) {
    children.push(new Paragraph({ children: [new TextRun({ text: content.header.contact, color: '444444', size: 20 })], spacing: { after: 200 } }));
  }

  for (const section of content.sections) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 80 },
        border: { bottom: { style: 'single', size: 6, space: 1, color: '000000' } },
        children: [new TextRun({ text: section.heading.toUpperCase(), bold: true, size: 22 })],
      }),
    );
    if (section.kind === 'text') {
      children.push(new Paragraph({ children: [new TextRun({ text: section.text, size: 21 })] }));
      continue;
    }
    for (const group of section.groups) {
      if (group.title) {
        children.push(
          new Paragraph({
            spacing: { before: 80 },
            children: [new TextRun({ text: [group.title, group.year].filter(Boolean).join('  ·  '), bold: true, size: 21 })],
          }),
        );
      }
      for (const bullet of group.bullets) {
        children.push(
          new Paragraph({ numbering: { reference: 'bullets', level: 0 }, children: [new TextRun({ text: bullet.text, size: 21 })] }),
        );
      }
    }
  }

  const document = new Document({
    creator: content.header.name,
    title: `${content.header.name} resume`,
    numbering: {
      config: [
        {
          reference: 'bullets',
          levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT }],
        },
      ],
    },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 } } }, children }],
  });
  return Packer.toBuffer(document);
}
