import { fileURLToPath } from 'node:url';
import type { TemplateDefinition } from '../template';
import { CLASSIC_RED_EXAMPLES } from './examples';
import { CLASSIC_RED_RULES } from './rules';

/** A single column with a bold name header, red section rules and skill dots. */
export const classicRed: TemplateDefinition = {
  id: 'classic-red',
  name: 'Classic red',
  description: 'Bold name, red section rules, skill ratings. Reads well on screen and on paper.',
  isDefault: true,
  previewPath: fileURLToPath(new URL('./preview.png', import.meta.url)),
  formatterRules: CLASSIC_RED_RULES,
  examples: CLASSIC_RED_EXAMPLES,
};
