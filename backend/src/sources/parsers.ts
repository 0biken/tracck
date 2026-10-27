// Turning uploaded files into text. Each function reads only what it expects and
// refuses anything that looks like an attack (oversized archives, odd files).

import { parse as parseCsv } from 'csv-parse/sync';
import { unzipSync, type Unzipped } from 'fflate';
import mammoth from 'mammoth';

export type FileKind = 'pdf' | 'zip';

/** What a file is, from its first bytes. The name and the declared type are not trusted. */
export function detectFileKind(buffer: Buffer): FileKind | null {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && [0x03, 0x05, 0x07].includes(buffer[2])) return 'zip';
  return null;
}

export class UnreadableFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnreadableFileError';
  }
}

export async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const document = await pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
      disableFontFace: true,
      verbosity: 0,
    }).promise;

    const pages: string[] = [];
    for (let number = 1; number <= Math.min(document.numPages, 30); number++) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      // New line where the text moves down the page; a space otherwise.
      let line = '';
      const lines: string[] = [];
      for (const item of content.items) {
        if (!('str' in item)) continue;
        line += item.str;
        if (item.hasEOL) {
          lines.push(line);
          line = '';
        } else if (item.str && !item.str.endsWith(' ')) {
          line += ' ';
        }
      }
      if (line.trim()) lines.push(line);
      pages.push(lines.map((entry) => entry.trim()).filter(Boolean).join('\n'));
    }
    return pages.join('\n\n').trim();
  } catch {
    throw new UnreadableFileError('We could not read that PDF.');
  }
}

export async function extractDocxText(buffer: Buffer): Promise<string> {
  try {
    const { value } = await mammoth.extractRawText({ buffer });
    return value.trim();
  } catch {
    throw new UnreadableFileError('We could not read that Word file.');
  }
}

export interface ParsedDocument {
  kind: 'linkedin_profile';
  title: string;
  text: string;
  date: Date | null;
}

const MAX_ARCHIVE_ENTRIES = 300;
const MAX_FILE_BYTES = 8_000_000;
const WANTED = ['profile.csv', 'positions.csv', 'education.csv', 'skills.csv', 'projects.csv', 'certifications.csv', 'shares.csv'];

/** X's archive keeps posts in data/tweets.js, or in numbered parts when the account has many. */
const X_POSTS_FILE = /^tweets?(-part\d+)?\.js$/;
const X_MAX_POSTS = 300;

/** The archive's own wrapper: `window.YTD.tweets.part0 = [ ... ];` */
const X_WRAPPER = /^\s*window\.YTD\.[\w.]+\s*=\s*/;

function unzipSafely(buffer: Buffer, wanted: (name: string) => boolean = (name) => WANTED.includes(name)): Unzipped {
  let entries = 0;
  try {
    return unzipSync(new Uint8Array(buffer), {
      filter(file) {
        entries += 1;
        if (entries > MAX_ARCHIVE_ENTRIES) throw new UnreadableFileError('That archive has too many files.');
        const name = file.name.split('/').pop()?.toLowerCase() ?? '';
        // Only the few files we use, and none large enough to be a decompression bomb.
        return wanted(name) && file.originalSize <= MAX_FILE_BYTES;
      },
    });
  } catch (error) {
    if (error instanceof UnreadableFileError) throw error;
    throw new UnreadableFileError('We could not open that archive.');
  }
}

function rows(file: Uint8Array | undefined): Record<string, string>[] {
  if (!file) return [];
  try {
    return parseCsv(Buffer.from(file), { columns: true, skip_empty_lines: true, relax_column_count: true, bom: true });
  } catch {
    return [];
  }
}

const dateOf = (value: string | undefined) => {
  if (!value) return null;
  const parsed = new Date(`${value} 1`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/** Profile, positions, education, skills, projects, certifications and recent posts from a LinkedIn data export. */
export function parseLinkedinExport(buffer: Buffer): ParsedDocument[] {
  const files = unzipSafely(buffer);
  const byName = (name: string) => Object.entries(files).find(([path]) => path.split('/').pop()?.toLowerCase() === name)?.[1];
  const documents: ParsedDocument[] = [];
  const add = (title: string, text: string, date: Date | null = null) => {
    if (text.trim().length > 0) documents.push({ kind: 'linkedin_profile', title, text: text.trim(), date });
  };

  const [profile] = rows(byName('profile.csv'));
  if (profile) add('LinkedIn profile', [profile['Headline'], profile['Summary']].filter(Boolean).join('\n\n'));

  for (const row of rows(byName('positions.csv'))) {
    const span = `${row['Started On'] ?? ''} – ${row['Finished On'] || 'present'}`.trim();
    add(
      `${row['Title'] ?? 'Role'} at ${row['Company Name'] ?? ''}`.trim(),
      `${row['Title'] ?? ''} at ${row['Company Name'] ?? ''} (${span}).\n${row['Description'] ?? ''}`,
      dateOf(row['Started On']),
    );
  }

  for (const row of rows(byName('education.csv'))) {
    add(
      `${row['Degree Name'] ?? 'Education'}, ${row['School Name'] ?? ''}`.trim(),
      `${row['Degree Name'] ?? ''} at ${row['School Name'] ?? ''} (${row['Start Date'] ?? ''} – ${row['End Date'] ?? ''}).\n${row['Notes'] ?? ''}`,
      dateOf(row['Start Date']),
    );
  }

  const skills = rows(byName('skills.csv')).map((row) => row['Name']).filter(Boolean);
  if (skills.length > 0) add('Skills', `Skills listed on LinkedIn: ${skills.join(', ')}.`);

  for (const row of rows(byName('projects.csv'))) {
    add(row['Title'] ?? 'Project', `${row['Title'] ?? ''}. ${row['Description'] ?? ''}`, dateOf(row['Started On']));
  }

  for (const row of rows(byName('certifications.csv'))) {
    add(row['Name'] ?? 'Certification', `${row['Name'] ?? ''}, ${row['Authority'] ?? ''}.`, dateOf(row['Started On']));
  }

  for (const row of rows(byName('shares.csv')).slice(0, 20)) {
    const text = row['ShareCommentary'] ?? '';
    if (text.length >= 80) add(`Post: ${text.slice(0, 60)}`, text, row['Date'] ? new Date(row['Date']) : null);
  }

  if (documents.length === 0) throw new UnreadableFileError('That archive does not look like a LinkedIn data export.');
  return documents;
}

/** Plain text from a web page: scripts, styles and markup removed. */
export interface XPost {
  /** The post's own ID, so re-reading the same archive never adds a post twice. */
  providerId: string;
  title: string;
  text: string;
  date: Date | null;
}

interface XArchivePost {
  id_str?: unknown;
  full_text?: unknown;
  created_at?: unknown;
}

/**
 * Reads the posts from an X data archive. Only the posts file is opened: profile details,
 * direct messages and everything else in the archive are never read. Retweets are not
 * the person's own work, so they are skipped.
 */
export function parseXArchive(buffer: Buffer): XPost[] {
  const files = unzipSafely(buffer, (name) => X_POSTS_FILE.test(name));
  const posts: XPost[] = [];

  for (const content of Object.values(files)) {
    const json = Buffer.from(content).toString('utf8').replace(X_WRAPPER, '').replace(/;\s*$/, '');
    let items: unknown;
    try {
      items = JSON.parse(json);
    } catch {
      throw new UnreadableFileError('The posts file in that archive could not be read.');
    }
    if (!Array.isArray(items)) throw new UnreadableFileError('The posts file in that archive could not be read.');

    for (const entry of items) {
      // Newer exports wrap each post as { tweet: {...} }; older ones list the post directly.
      const post = (typeof entry === 'object' && entry !== null && 'tweet' in entry ? entry.tweet : entry) as XArchivePost;
      const text = typeof post?.full_text === 'string' ? post.full_text.trim() : '';
      if (!text || text.startsWith('RT @') || typeof post.id_str !== 'string') continue;
      const date = typeof post.created_at === 'string' ? new Date(post.created_at) : null;
      posts.push({
        providerId: post.id_str,
        title: text.length > 80 ? `${text.slice(0, 77).trimEnd()}...` : text,
        text,
        date: date && !Number.isNaN(date.getTime()) ? date : null,
      });
      if (posts.length >= X_MAX_POSTS) return posts;
    }
  }
  return posts;
}

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|section|article|tr|br)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
