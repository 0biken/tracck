/**
 * Firecrawl client wrapper.
 *
 * When FIRECRAWL_API_KEY is set → calls the managed Firecrawl API which runs a
 * real headless Chrome, handles JS rendering, proxy rotation, and anti-bot.
 *
 * When the key is absent → falls back to a plain fetch() + HTML-to-Markdown
 * conversion (works on simple static sites; fails on JS-heavy pages like
 * Behance or LinkedIn).
 */

export interface ScrapeResult {
  markdown: string;
  title: string;
  /** True if the Firecrawl managed service was used; false = raw fetch fallback */
  usedFirecrawl: boolean;
}

// ── HTML helpers ──────────────────────────────────────────────────────────────

function stripTag(html: string): string {
  return html
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Very lightweight HTML → Markdown conversion used for the raw-fetch fallback.
 * Preserves heading hierarchy and paragraph breaks.
 */
function htmlToMarkdown(html: string): string {
  return html
    // Remove noise
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    // Headings
    .replace(/<h1[^>]*>/gi, '\n\n# ')
    .replace(/<\/h1>/gi, '\n\n')
    .replace(/<h2[^>]*>/gi, '\n\n## ')
    .replace(/<\/h2>/gi, '\n\n')
    .replace(/<h3[^>]*>/gi, '\n\n### ')
    .replace(/<\/h3>/gi, '\n\n')
    .replace(/<h[4-6][^>]*>/gi, '\n\n#### ')
    .replace(/<\/h[4-6]>/gi, '\n\n')
    // Paragraphs / line breaks
    .replace(/<\/?(p|div|section|article|header|footer|nav|li)[^>]*>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    // Strip remaining tags
    .replace(/<[^>]+>/g, '')
    // Decode entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Normalise whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ── Core scrape function ──────────────────────────────────────────────────────

export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  const apiKey = process.env.FIRECRAWL_API_KEY;

  if (apiKey) {
    return scrapeWithFirecrawl(url, apiKey);
  }
  return scrapeWithRawFetch(url);
}

// ── Firecrawl path ────────────────────────────────────────────────────────────

async function scrapeWithFirecrawl(url: string, apiKey: string): Promise<ScrapeResult> {
  const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      formats: ['markdown'],
      // Scroll page to trigger lazy-loaded content (e.g. LinkedIn Activity)
      actions: [
        { type: 'wait', milliseconds: 1500 },
        { type: 'scroll', direction: 'down', amount: 800 },
        { type: 'wait', milliseconds: 800 },
      ],
    }),
    signal: AbortSignal.timeout(45_000), // Firecrawl can be slow on first render
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Firecrawl API error ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = await res.json();

  // Firecrawl v1 wraps results in a `data` key
  const data = json?.data ?? json;
  const markdown: string = data?.markdown ?? '';
  const title: string =
    data?.metadata?.title ??
    data?.metadata?.ogTitle ??
    new URL(url).hostname;

  if (!markdown) {
    throw new Error('Firecrawl returned an empty page. The URL may be behind a login wall.');
  }

  return { markdown, title, usedFirecrawl: true };
}

// ── Raw fetch fallback ────────────────────────────────────────────────────────

async function scrapeWithRawFetch(url: string): Promise<ScrapeResult> {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(
      `Server returned HTTP ${res.status}. ` +
        'The page may be behind a login or blocked to bots. ' +
        'Set FIRECRAWL_API_KEY for better results.'
    );
  }

  const html = await res.text();
  const markdown = htmlToMarkdown(html);

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? stripTag(titleMatch[1]) : new URL(url).hostname;

  return { markdown, title, usedFirecrawl: false };
}
