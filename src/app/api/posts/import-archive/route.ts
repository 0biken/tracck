/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import JSZip from 'jszip';
import { requireAuth } from '@/lib/auth';
import { ApiError, errorResponse, successResponse } from '@/lib/errors';
import { createAdminClient } from '@/lib/supabase-admin';
import { inngest } from '@/inngest/client';

// ── CSV parser (minimal, handles quoted fields) ───────────────────────────────

function parseCSV(csv: string): Record<string, string>[] {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = splitCSVLine(lines[0]);
  return lines.slice(1).flatMap(line => {
    const values = splitCSVLine(line);
    if (values.length !== headers.length) return [];
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h.trim()] = values[i]?.trim() ?? ''));
    return [row];
  });
}

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ── Platform-specific archive parsers ─────────────────────────────────────────

function parseLinkedInArchive(zip: JSZip): { text: string; date?: string }[] {
  // LinkedIn exports Shares.csv for posts
  const sharesFile = zip.file('Shares.csv') ?? zip.file(/Shares/i)[0];
  if (!sharesFile) return [];

  return sharesFile
    .async('string')
    .then(csv => {
      const rows = parseCSV(csv);
      return rows
        .filter(r => r['ShareCommentary'] && r['ShareCommentary'].length > 10)
        .map(r => ({
          text: r['ShareCommentary'],
          date: r['Date'] ? r['Date'].split(' ')[0] : undefined,
        }));
    }) as any; // handled by awaiting in the route
}

async function parseLinkedInArchiveAsync(zip: JSZip): Promise<{ text: string; date?: string }[]> {
  const sharesFile = zip.file('Shares.csv') ?? zip.file(/Shares\.csv$/i)[0];
  if (!sharesFile) {
    // Try "Posts.csv" (older exports)
    const postsFile = zip.file('Posts.csv') ?? zip.file(/Posts\.csv$/i)[0];
    if (!postsFile) return [];
    const csv = await postsFile.async('string');
    const rows = parseCSV(csv);
    return rows
      .filter(r => (r['Commentary'] || r['ShareCommentary'] || r['Post']) && true)
      .map(r => ({
        text: r['Commentary'] ?? r['ShareCommentary'] ?? r['Post'] ?? '',
        date: r['Date'] ? r['Date'].split(' ')[0] : undefined,
      }))
      .filter(r => r.text.length > 10);
  }

  const csv = await sharesFile.async('string');
  const rows = parseCSV(csv);
  return rows
    .filter(r => r['ShareCommentary'] && r['ShareCommentary'].length > 10)
    .map(r => ({
      text: r['ShareCommentary'],
      date: r['Date'] ? r['Date'].split(' ')[0] : undefined,
    }));
}

async function parseInstagramArchiveAsync(zip: JSZip): Promise<{ text: string; date?: string }[]> {
  // Instagram: content/posts_1.json
  const postsFile =
    zip.file('content/posts_1.json') ??
    zip.file(/posts_\d+\.json$/i)[0];

  if (!postsFile) return [];

  const raw = await postsFile.async('string');
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }

  // The JSON is an array of post objects
  const posts: any[] = Array.isArray(data) ? data : data?.posts ?? [];

  return posts.flatMap((post: any) => {
    const media: any[] = post?.media ?? [post];
    return media
      .filter((m: any) => m?.title && m.title.length > 5)
      .map((m: any) => ({
        text: m.title,
        date: m.creation_timestamp
          ? new Date(m.creation_timestamp * 1000).toISOString().split('T')[0]
          : undefined,
      }));
  });
}

async function parseTwitterArchiveAsync(zip: JSZip): Promise<{ text: string; date?: string }[]> {
  const tweetsFile =
    zip.file('data/tweets.js') ??
    zip.file('data/tweet.js') ??
    zip.file(/tweets?\.js$/i)[0];

  if (!tweetsFile) return [];

  let raw = await tweetsFile.async('string');
  // Twitter wraps the JSON in a JS assignment: window.YTD.tweets.part0 = [...]
  raw = raw.replace(/^window\.[^=]+=\s*/, '').trim();
  if (raw.endsWith(';')) raw = raw.slice(0, -1);

  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }

  const items: any[] = Array.isArray(data) ? data : [];

  const results: { text: string; date?: string }[] = [];
  for (const item of items) {
    const tweet = item?.tweet ?? item;
    const raw: string = tweet?.full_text ?? tweet?.text ?? '';
    if (raw.startsWith('@') || raw.startsWith('RT ')) continue;
    const text = raw.replace(/https?:\/\/t\.co\/\S+/g, '').trim();
    if (text.length <= 10) continue;
    const created = tweet?.created_at;
    results.push({
      text,
      date: created ? new Date(created).toISOString().split('T')[0] : undefined,
    });
  }
  return results;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const { user_id } = await requireAuth(request);
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const platform = (formData.get('platform') as string | null) ?? 'unknown';
    const attestedStr = formData.get('ownership_attested') as string | null;

    if (!attestedStr || attestedStr !== 'true') {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Ownership attestation is required.');
    }

    if (!file || !file.name.endsWith('.zip')) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Please upload a .zip file exported from the platform.');
    }

    const buffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);

    let entries: { text: string; date?: string }[] = [];

    if (platform === 'linkedin') {
      entries = await parseLinkedInArchiveAsync(zip);
    } else if (platform === 'instagram') {
      entries = await parseInstagramArchiveAsync(zip);
    } else if (platform === 'twitter') {
      entries = await parseTwitterArchiveAsync(zip);
    } else {
      // Try all parsers and pick whichever returns results
      entries = await parseLinkedInArchiveAsync(zip);
      if (!entries.length) entries = await parseInstagramArchiveAsync(zip);
      if (!entries.length) entries = await parseTwitterArchiveAsync(zip);
    }

    if (entries.length === 0) {
      throw new ApiError(
        422,
        'UNPROCESSABLE',
        'No posts were found in the archive. ' +
        'Make sure you selected the correct platform and that the ZIP file is the official data export.'
      );
    }

    const posts = entries.slice(0, 200).map((entry, idx) => ({
      user_id,
      source_platform: platform,
      source_method: 'file_upload',
      raw_text: entry.text,
      ownership_attested: true,
      posted_at_is_approximate: false,
      date: entry.date ?? null,
      fetched_at: new Date().toISOString(),
      segment_index: idx,
    }));

    if (posts.length > 0) {
      const supabase = createAdminClient();
      const { data: insertedPosts, error: insertError } = await supabase
        .from('raw_posts')
        .insert(posts)
        .select('id');

      if (insertError) {
        console.error('Failed to insert archive posts:', insertError);
        throw new ApiError(500, 'DATABASE_ERROR', 'Failed to save posts to database.');
      }
      
      if (insertedPosts) {
        for (const post of insertedPosts) {
          await inngest.send({
            name: 'ai/claim.classify',
            data: { rawPostId: post.id }
          });
        }
      }
    }

    return successResponse({
      platform,
      ingested_count: posts.length,
      user_id,
      posts,
      fetched_at: new Date().toISOString(),
    });
  } catch (err: any) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError(500, 'INTERNAL_ERROR', err.message || 'Internal Server Error'));
  }
}
