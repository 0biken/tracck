import type { ContentSegment } from '../platform';
import { extractGeneric } from './generic';

/**
 * Instagram public profile extractor.
 *
 * Instagram public profiles (viewed without login) show:
 *  - Bio / username / follower counts at the top
 *  - A grid of recent posts with visible captions
 *
 * Firecrawl renders the page and returns Markdown where each post caption
 * appears as a distinct paragraph block. We filter out UI noise (follower
 * counts, navigation labels, "Follow" buttons) and keep the caption text.
 */
export function extractInstagram(markdown: string): ContentSegment[] {
  const segments: ContentSegment[] = [];

  // ── 1. Bio ─────────────────────────────────────────────────────────────────
  // The bio appears as the first substantial paragraph after the username heading
  const bioMatch = markdown.match(/^#\s+@?[\w.]+\s*\n+([\s\S]{20,300}?)(?:\n{2,}|\d+ (posts|followers))/im);
  if (bioMatch) {
    const bio = bioMatch[1].replace(/\n/g, ' ').trim();
    if (bio.length > 20 && !/^\d/.test(bio)) {
      segments.push({ text: bio, type: 'bio' });
    }
  }

  // ── 2. Post captions ────────────────────────────────────────────────────────
  // Caption blocks are separated by blank lines, tend to be multi-sentence
  // or contain hashtag clusters. We keep blocks that look like captions.
  const blocks = markdown
    .split(/\n{2,}/)
    .map(b => b.replace(/^[#*\->\s]+/, '').trim())
    .filter(b => {
      if (b.length < 30) return false;
      // Skip obvious UI strings
      if (/^(follow|following|posts|followers|explore|reels|tagged|saved)/i.test(b)) return false;
      if (/^\d+(,\d+)*\s*(posts|followers|following)/i.test(b)) return false;
      // Keep blocks that look like captions (have words, possibly hashtags)
      return /[a-zA-Z]{4,}/.test(b);
    });

  for (const block of blocks) {
    // Separate main caption from hashtag blob at the end
    const hashtagSplit = block.split(/(?<!\w)#\w+/);
    const mainText = hashtagSplit[0].trim();

    // Extract hashtags as context
    const hashtagMatches = block.match(/#\w+/g) ?? [];
    const hashtags = hashtagMatches.join(' ');

    const fullText = mainText + (hashtags ? `\n\n${hashtags}` : '');
    if (fullText.trim().length > 30) {
      segments.push({ text: fullText.trim(), type: 'caption' });
    }
  }

  if (segments.length < 2) {
    return extractGeneric(markdown);
  }

  return segments.slice(0, 40);
}
