import type { ContentSegment } from '../platform';
import { extractGeneric } from './generic';

/**
 * Behance profile extractor.
 *
 * A Behance profile page looks like this in Markdown:
 *
 *   # Jane Doe — Product Designer
 *   San Francisco · Adobe · 3.2K appreciations
 *
 *   ## Projects
 *
 *   ### Brand Identity — TechCorp
 *   *Branding · Logo Design · Typography*
 *   Redesigned the complete brand system for a B2B SaaS startup,
 *   increasing brand recognition by 40%...
 *
 *   ### UI/UX Redesign — HealthApp
 *   *UI/UX · Figma · User Research*
 *   Led a 3-month redesign sprint...
 *
 * We extract each project as a segment and include the tools/skills context.
 */
export function extractBehance(markdown: string): ContentSegment[] {
  const segments: ContentSegment[] = [];

  // ── 1. Profile headline / bio ───────────────────────────────────────────────
  const headlineMatch = markdown.match(/^#\s+(.+)\n+([\s\S]{20,300}?)(?=\n##\s|\n###\s|\n{3,})/m);
  if (headlineMatch) {
    const headline = headlineMatch[1].trim();
    const context = headlineMatch[2].replace(/\n/g, ' ').trim();
    // Skip if context is just stats like "3.2K appreciations · 120 followers"
    if (!/^\d/.test(context) && context.length > 20) {
      segments.push({ text: `${headline}\n${context}`, type: 'bio' });
    } else {
      segments.push({ text: headline, type: 'headline' });
    }
  }

  // ── 2. Project entries (level-3 headings) ──────────────────────────────────
  // Split by "### " to get individual projects
  const projectSections = markdown.split(/\n###\s+/).slice(1);

  for (const section of projectSections) {
    const lines = section.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) continue;

    const title = lines[0]; // "Brand Identity — TechCorp"

    // Tools line is usually italicised: *Branding · Logo Design*
    const toolsLine = lines.find(l => l.startsWith('*') && l.endsWith('*')) ?? '';
    const tools = toolsLine.replace(/\*/g, '').trim();

    // Body = everything else
    const bodyLines = lines.filter(l => l !== title && l !== toolsLine);
    const body = bodyLines.join(' ').trim();

    const textParts = [title, tools ? `Tools: ${tools}` : '', body].filter(Boolean);
    const text = textParts.join('\n');

    if (text.length > 30) {
      segments.push({
        text,
        type: 'project',
        context: title,
      });
    }
  }

  // ── 3. Appreciated projects section ────────────────────────────────────────
  // Sometimes the page lists "Appreciated" or "Work Experience" sections
  const workSection = markdown.match(/##\s*(Work Experience|About)\s*\n([\s\S]*?)(?=\n##\s|\n---|\s*$)/i);
  if (workSection) {
    const text = workSection[2].replace(/\n/g, ' ').trim();
    if (text.length > 40) {
      segments.push({ text, type: 'experience' });
    }
  }

  if (segments.length < 2) {
    return extractGeneric(markdown);
  }

  return segments.slice(0, 40);
}
