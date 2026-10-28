import { fileURLToPath } from 'node:url';
import type { TemplateDefinition } from '../template';
import { CLASSIC_RED_SAMPLES } from './examples';
import { CLASSIC_RED_RULES } from './rules';

/** A single column with a bold name header, red section rules and skill dots. */
export const classicRed: TemplateDefinition = {
  id: 'classic-red',
  name: 'Classic red',
  description: 'Bold name, red section rules.',
  isDefault: true,
  previewPath: fileURLToPath(new URL('./preview.png', import.meta.url)),
  sections: [
    {
      id: 'profile',
      heading: 'Profile',
      purpose: 'Two or three sentences that position the person now: their specialism, the proof of it, and what they optimise for. No tool lists.',
      evidence: ['role', 'achievement', 'leadership'],
    },
    {
      id: 'experience',
      heading: 'Work experience',
      purpose: 'The roles most relevant to the job, newest first within relevance. Each bullet shows an action, its scope and, where the evidence gives one, a result.',
      evidence: ['role', 'achievement', 'responsibility', 'project', 'metric'],
    },
    {
      id: 'education',
      heading: 'Education',
      purpose: 'Degrees and certificates that support the job, with the institution and span. No detail beyond that.',
      evidence: ['education', 'certification'],
    },
    {
      id: 'skills',
      heading: 'Skills',
      purpose: 'Named, checkable tools and methods the person has used, each rated by how often their work shows it.',
      evidence: ['skill'],
    },
    {
      id: 'strengths',
      heading: 'Strengths',
      purpose: 'Traits and ways of working that the person’s work shows. Behaviours, never tools.',
      evidence: ['leadership', 'responsibility'],
    },
  ],
  details: ['dateOfBirth', 'nationality', 'address', 'phone', 'email'],
  formatterRules: CLASSIC_RED_RULES,
  samples: CLASSIC_RED_SAMPLES,
};
