/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { requireAuth } from '@/lib/auth';
import { ApiError, errorResponse, successResponse } from '@/lib/errors';
import { scrapeUrl } from '@/lib/scrapers/firecrawl';
import { detectPlatform, PLATFORM_META } from '@/lib/scrapers/platform';
import { extractLinkedIn } from '@/lib/scrapers/extractors/linkedin';
import { extractInstagram } from '@/lib/scrapers/extractors/instagram';
import { extractBehance } from '@/lib/scrapers/extractors/behance';
import { extractGeneric } from '@/lib/scrapers/extractors/generic';

export async function POST(request: Request) {
  try {
    const { user_id } = await requireAuth(request);
    const body = await request.json();
    const { url, ownership_attested } = body as {
      url?: string;
      ownership_attested?: boolean;
    };

    // ── Validation ─────────────────────────────────────────────────────────────
    if (!ownership_attested) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Ownership attestation is required before scraping.');
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url ?? '');
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error();
    } catch {
      throw new ApiError(400, 'VALIDATION_ERROR', 'A valid https:// URL is required.');
    }

    const platform = detectPlatform(url!);
    const meta = PLATFORM_META[platform];

    // Bail early for platforms we know are behind login walls
    if (!meta.scrapable) {
      throw new ApiError(422, 'UNPROCESSABLE', meta.scrapeLimit ?? 'This platform cannot be scraped.', {
        platform,
        platform_label: meta.label,
        requires_zip: meta.supportsZipImport,
      });
    }

    // ── Scrape ─────────────────────────────────────────────────────────────────
    let scrapeResult;
    try {
      scrapeResult = await scrapeUrl(url!);
    } catch (scrapeErr: any) {
      throw new ApiError(502, 'UPSTREAM_ERROR', scrapeErr.message ?? 'Could not fetch the page.', {
        platform,
        platform_label: meta.label,
        tip: !process.env.FIRECRAWL_API_KEY
          ? 'Add a FIRECRAWL_API_KEY to .env.local for JavaScript-rendered pages.'
          : undefined,
      });
    }

    // ── Extract segments using platform-specific logic ──────────────────────────
    const segments = (() => {
      switch (platform) {
        case 'linkedin': return extractLinkedIn(scrapeResult.markdown);
        case 'instagram': return extractInstagram(scrapeResult.markdown);
        case 'behance':
        case 'dribbble': return extractBehance(scrapeResult.markdown);
        default: return extractGeneric(scrapeResult.markdown);
      }
    })();

    if (segments.length === 0) {
      throw new ApiError(422, 'UNPROCESSABLE',
        'No meaningful content was extracted from this page. ' +
        'The page may require a login, use heavy JavaScript, or block automated access. ' +
        (!process.env.FIRECRAWL_API_KEY
          ? 'Adding FIRECRAWL_API_KEY to .env.local may help.'
          : 'Try the Archive ZIP import option instead.'),
        { platform, platform_label: meta.label }
      );
    }

    // ── Build raw_posts-compatible payload ─────────────────────────────────────
    const posts = segments.map((seg, idx) => ({
      source_platform: platform,
      source_method: 'url_scrape',
      raw_text: seg.text,
      content_type: seg.type,
      source_url: url,
      ownership_attested: true,
      posted_at_is_approximate: true,
      date: seg.date ?? null,
      context: seg.context ?? null,
      fetched_at: new Date().toISOString(),
      segment_index: idx,
    }));

    return successResponse({
      platform,
      platform_label: meta.label,
      page_title: scrapeResult.title,
      source_url: url,
      ingested_count: posts.length,
      user_id,
      used_firecrawl: scrapeResult.usedFirecrawl,
      posts,
      fetched_at: new Date().toISOString(),
    });
  } catch (err: any) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError(500, 'INTERNAL_ERROR', err.message || 'Internal Server Error'));
  }
}
