import { NextResponse } from 'next/server';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Strip HTML tags and normalise whitespace. */
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Split a blob of plain text into meaningful content segments.
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
    const body = await request.json();
    const { url, ownership_attested } = body as { url?: string; ownership_attested?: boolean };

    // ── Validation ────────────────────────────────────────────────────────────
    if (!ownership_attested) {
      return NextResponse.json(
        { error: 'Ownership attestation is required before fetching.' },
        { status: 400 }
      );
    }

    if (!url || !isValidUrl(url)) {
      return NextResponse.json(
        { error: 'A valid https:// URL is required.' },
        { status: 400 }
      );
    }

    // ── Fetch the page ────────────────────────────────────────────────────────
    let html: string;
    try {
      const response = await fetch(url, {
        headers: {
          // Pose as a normal browser so most public portfolio sites respond
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        // Hard timeout via AbortController
        signal: AbortSignal.timeout(12_000),
      });

      if (!response.ok) {
        return NextResponse.json(
          { error: `Remote server returned ${response.status} – make sure the page is publicly accessible.` },
          { status: 502 }
        );
      }

      html = await response.text();
    } catch (fetchErr: any) {
      const isTimeout = fetchErr?.name === 'TimeoutError' || fetchErr?.name === 'AbortError';
      return NextResponse.json(
        { error: isTimeout ? 'Request timed out (12 s). The page may be too slow or blocked.' : `Could not reach ${url}` },
        { status: 502 }
      );
    }

    // ── Extract meta information ──────────────────────────────────────────────
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const pageTitle = titleMatch ? stripHtml(titleMatch[1]) : new URL(url).hostname;

    // Prefer <main>, <article>, or <body> content in that order
    const mainMatch =
      html.match(/<main[\s\S]*?>([\s\S]*?)<\/main>/i) ||
      html.match(/<article[\s\S]*?>([\s\S]*?)<\/article>/i) ||
      html.match(/<body[\s\S]*?>([\s\S]*?)<\/body>/i);

    const rawText = mainMatch ? stripHtml(mainMatch[1]) : stripHtml(html);
    const segments = extractSegments(rawText);

    // Cap at 40 segments so we don't flood the database
    const cappedSegments = segments.slice(0, 40);

    // ── Build raw_posts-compatible payload ────────────────────────────────────
    const posts = cappedSegments.map((text, idx) => ({
      source_platform: 'portfolio_url',
      source_method: 'url_fetch',
      raw_text: text,
      source_url: url,
      ownership_attested: true,
      posted_at_is_approximate: true,
      // We don't know dates so we leave it null – caller may fill
      fetched_at: new Date().toISOString(),
      segment_index: idx,
    }));

    return NextResponse.json({
      success: true,
      page_title: pageTitle,
      source_url: url,
      ingested_count: posts.length,
      posts,
      fetched_at: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
