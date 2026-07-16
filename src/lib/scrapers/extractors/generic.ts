import type { ContentSegment } from '../platform';

/**
 * Generic extractor — used as a fallback for any URL that doesn't match a
 * known platform, or when platform-specific extraction yields too few results.
 *
 * Strategy:
 *  1. Split Markdown on double-newlines (paragraph blocks)
 *  2. Filter out navigation noise (short lines, repeated boilerplate)
 *  3. Return up to 40 segments
 */
export function extractGeneric(markdown: string): ContentSegment[] {
  const blocks = markdown
    .split(/\n{2,}/)
    .map(b => b.replace(/^[#*\->\s]+/, '').trim()) // strip Markdown symbols at line start
    .filter(b => {
      if (b.length < 60) return false; // too short to be meaningful content
      if (/^(menu|nav|footer|cookie|privacy|terms|sign in|log in|copyright)/i.test(b)) return false;
      if (/^\d+$/.test(b)) return false; // pure numbers
      return true;
    });

  if (blocks.length >= 2) {
    return blocks.slice(0, 40).map(text => ({ text, type: 'generic' }));
  }

  // Fallback: sentence extraction when paragraphs are too fused
  const sentences = markdown.match(/[^.!?\n]{60,}[.!?]/g) ?? [];
  return sentences
    .slice(0, 40)
    .map(s => ({ text: s.trim(), type: 'generic' }));
}
