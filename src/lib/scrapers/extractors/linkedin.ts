import type { ContentSegment } from '../platform';
import { extractGeneric } from './generic';

/**
 * LinkedIn profile Markdown extractor.
 *
 * Firecrawl (or our fallback) converts a LinkedIn profile page to Markdown
 * that typically has this structure:
 *
 *   # John Doe
 *   Software Engineer at Google
 *
 *   ## About
 *   I'm a software engineer with 5 years of experience...
 *
 *   ## Experience
 *   ### Senior Software Engineer · Google
 *   *Jan 2020 – Present · London, UK*
 *   Led the development of...
 *
 *   ## Skills
 *   Python · TypeScript · React · Node.js
 *
 *   ## Activity
 *   I just launched a new project that...
 *   *2 weeks ago · 42 reactions*
 *
 * We extract each meaningful section and tag it so downstream processing
 * knows the content type.
 */
export function extractLinkedIn(markdown: string): ContentSegment[] {
  const segments: ContentSegment[] = [];

  // ── 1. About section ────────────────────────────────────────────────────────
  const aboutMatch = markdown.match(/##\s*About\s*\n([\s\S]*?)(?=\n##\s|\n---|\s*$)/i);
  if (aboutMatch) {
    const text = aboutMatch[1].trim();
    if (text.length > 40) {
      segments.push({ text, type: 'about' });
    }
  }

  // ── 2. Headline (first non-heading line below the name) ────────────────────
  const headlineMatch = markdown.match(/^#\s+[^\n]+\n+([^\n#][^\n]{20,})/m);
  if (headlineMatch) {
    segments.push({ text: headlineMatch[1].trim(), type: 'headline' });
  }

  // ── 3. Experience entries ──────────────────────────────────────────────────
  const experienceSection = markdown.match(/##\s*Experience\s*\n([\s\S]*?)(?=\n##\s|\n---|\s*$)/i);
  if (experienceSection) {
    // Each job is a level-3 heading
    const jobs = experienceSection[1].split(/\n###\s+/).filter(Boolean);
    for (const job of jobs) {
      const lines = job.split('\n').map(l => l.trim()).filter(Boolean);
      if (!lines.length) continue;

      const title = lines[0]; // "Senior Engineer · Google"
      // Date line is usually italicised: *Jan 2020 – Present*
      const dateLine = lines.find(l => /\*[A-Z][a-z]{2}/.test(l)) ?? '';
      const dateMatch = dateLine.match(/(\w+ \d{4})\s*[–-]\s*(\w+ \d{4}|Present)/i);

      // Body = everything after the title and date lines
      const body = lines
        .slice(dateLine ? 2 : 1)
        .filter(l => !l.startsWith('*'))
        .join(' ')
        .trim();

      if (body.length > 40 || title.length > 20) {
        const text = [title, body].filter(Boolean).join('\n');
        segments.push({
          text,
          type: 'experience',
          context: title,
          date: dateMatch ? `${dateMatch[1]}` : undefined,
        });
      }
    }
  }

  // ── 4. Activity / Posts ────────────────────────────────────────────────────
  const activitySection = markdown.match(/##\s*Activity\s*\n([\s\S]*?)(?=\n##\s|\n---|\s*$)/i);
  if (activitySection) {
    // Posts are separated by blank lines; reaction lines match "· N reactions"
    const posts = activitySection[1]
      .split(/\n{2,}/)
      .map(block => {
        // Strip reaction/date lines like "*2 weeks ago · 42 reactions*"
        return block
          .split('\n')
          .filter(l => !/^\*[0-9]|reactions|reposts|likes/i.test(l))
          .join(' ')
          .trim();
      })
      .filter(p => p.length > 40);

    for (const post of posts) {
      segments.push({ text: post, type: 'post' });
    }
  }

  // ── 5. Skills (comma/bullet list → single segment) ─────────────────────────
  const skillsMatch = markdown.match(/##\s*Skills\s*\n([\s\S]*?)(?=\n##\s|\n---|\s*$)/i);
  if (skillsMatch) {
    const text = skillsMatch[1]
      .replace(/\n/g, ' ')
      .replace(/[*·•]/g, ',')
      .replace(/,+/g, ',')
      .trim();
    if (text.length > 20) {
      segments.push({ text: `Skills: ${text}`, type: 'skills' });
    }
  }

  // If we found very little, fall back to the generic extractor
  if (segments.length < 2) {
    return extractGeneric(markdown);
  }

  return segments.slice(0, 40);
}
