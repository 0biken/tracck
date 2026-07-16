/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { requireAuth } from '@/lib/auth';
import { ApiError, errorResponse, successResponse } from '@/lib/errors';
import { createAdminClient } from '@/lib/supabase-admin';
import { queues } from '../../../../../workers/queues';
import FirecrawlApp from '@mendable/firecrawl-js';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Split a blob of plain text or markdown into meaningful content segments.
 *  Heuristic: paragraphs separated by 2+ newlines, or sentences > 60 chars. */
function extractSegments(text: string): string[] {
  // Try double-newline split first
  const blocks = text.split(/\n{2,}/).map(b => b.trim()).filter(b => b.length > 60);

  if (blocks.length >= 2) return blocks;

  // Fallback: period-terminated sentences
  const sentences = text.match(/[^.!?]{60,}[.!?]/g) || [];
  return sentences.map(s => s.trim()).filter(Boolean);
}

/** Very lightweight check that a string looks like a URL we can fetch. */
function isValidUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const { user_id } = await requireAuth(request);
    const body = await request.json();
    const { url, ownership_attested } = body as { url?: string; ownership_attested?: boolean };

    // ── Validation ────────────────────────────────────────────────────────────
    if (!ownership_attested) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Ownership attestation is required before fetching.');
    }

    if (!url || !isValidUrl(url)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'A valid https:// URL is required.');
    }

    // ── Fetch the page via Firecrawl ──────────────────────────────────────────
    if (!process.env.FIRECRAWL_API_KEY) {
      throw new ApiError(500, 'INTERNAL_ERROR', 'Firecrawl API key is missing.');
    }

    const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
    
    let scrapeResult;
    try {
      scrapeResult = await app.scrapeUrl(url, { formats: ['markdown'] });
    } catch (err: any) {
      throw new ApiError(502, 'UPSTREAM_ERROR', `Failed to scrape via Firecrawl: ${err.message}`);
    }

    if (!scrapeResult) {
       throw new ApiError(502, 'UPSTREAM_ERROR', `Firecrawl failed to scrape: No data returned`);
    }

    const pageTitle = scrapeResult.metadata?.title || new URL(url).hostname;
    const rawText = scrapeResult.markdown || '';
    const segments = extractSegments(rawText);

    // Cap at 40 segments so we don't flood the database
    const cappedSegments = segments.slice(0, 40);

    // ── Build raw_posts-compatible payload ────────────────────────────────────
    const posts = cappedSegments.map((text, idx) => ({
      user_id,
      source_platform: 'portfolio_url',
      source_method: 'manual_paste', // mapped to satisfy DB constraint
      raw_text: text,
      source_url: url,
      ownership_attested: true,
      posted_at_is_approximate: true,
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
        console.error('Failed to insert URL fetched posts:', insertError);
        throw new ApiError(500, 'DATABASE_ERROR', 'Failed to save posts to database.');
      }
      
      if (insertedPosts) {
        for (const post of insertedPosts) {
          await queues.aiExtraction.add('claim-classification', {
            rawPostId: post.id,
          });
        }
      }
    }

    return successResponse({
      page_title: pageTitle,
      source_url: url,
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
