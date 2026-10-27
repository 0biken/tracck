// Small real files for upload tests: a PDF, a Word document and a LinkedIn export.

import { strToU8, zipSync } from 'fflate';

/** An X data archive: posts in data/tweets.js, the account details in data/account.js. */
export function makeXArchive(posts: { id: string; text: string; created?: string }[]): Buffer {
  const tweets = posts.map((post) => ({
    tweet: { id_str: post.id, full_text: post.text, created_at: post.created ?? 'Wed Oct 10 20:19:24 +0000 2018' },
  }));
  const retweet = { tweet: { id_str: 'rt-1', full_text: 'RT @someone: a post that is not theirs', created_at: 'Wed Oct 10 20:19:24 +0000 2018' } };
  return Buffer.from(
    zipSync({
      'data/tweets.js': strToU8(`window.YTD.tweets.part0 = ${JSON.stringify([...tweets, retweet], null, 2)}`),
      'data/account.js': strToU8('window.YTD.account.part0 = [{"account":{"email":"private@example.com"}}]'),
    }),
  );
}

export const CV_LINES = [
  'Built a NestJS subscription billing service that retries failed card charges through BullMQ queues.',
  'Designed idempotent webhook handling for Paystack events using Redis locks to prevent double charges.',
  'Containerised a NestJS API with Docker and shipped it through GitHub Actions to production.',
];

/** A one-page PDF with the lines as separate text rows. */
export function makePdf(lines: string[] = CV_LINES): Buffer {
  const escape = (text: string) => text.replace(/[\\()]/g, '\\$&');
  const content = `BT /F1 11 Tf 72 720 Td 16 TL ${lines.map((line) => `(${escape(line)}) Tj T*`).join(' ')} ET`;
  const objects = [
    '<</Type/Catalog/Pages 2 0 R>>',
    '<</Type/Pages/Kids[3 0 R]/Count 1>>',
    '<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>',
    `<</Length ${content.length}>>\nstream\n${content}\nendstream`,
    '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>',
  ];

  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) body += `${String(offset).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body, 'latin1');
}

/** A minimal Word document with one paragraph per line. */
export function makeDocx(lines: string[] = CV_LINES): Buffer {
  const xml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const paragraphs = lines.map((line) => `<w:p><w:r><w:t>${xml(line)}</w:t></w:r></w:p>`).join('');
  return Buffer.from(
    zipSync({
      '[Content_Types].xml': strToU8(
        '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
      ),
      '_rels/.rels': strToU8(
        '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
      ),
      'word/document.xml': strToU8(
        `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}</w:body></w:document>`,
      ),
    }),
  );
}

/** A LinkedIn data export with a profile, two positions, education and skills. */
export function makeLinkedinZip(): Buffer {
  return Buffer.from(
    zipSync({
      'Profile.csv': strToU8('First Name,Last Name,Headline,Summary\nTolu,Adebayo,Backend developer,"Building payment services in NestJS and Go for Nigerian startups."\n'),
      'Positions.csv': strToU8(
        'Company Name,Title,Description,Location,Started On,Finished On\nLemni,Backend Developer,"Built the billing engine with NestJS, PostgreSQL and BullMQ.",Lagos,Mar 2026,\nLogistics Co,Contract Developer,"Containerised a NestJS API with Docker and set up CI/CD.",Remote,Jan 2025,Dec 2025\n',
      ),
      'Education.csv': strToU8('School Name,Start Date,End Date,Notes,Degree Name\nUniversity of Ibadan,2022,2026,Computer Science coursework,B.Sc. Computer Science\n'),
      'Skills.csv': strToU8('Name\nTypeScript\nPostgreSQL\nRedis\n'),
    }),
  );
}
