import { ApiError } from '@tracck/shared';
import { classicRed } from './classic-red';
import type { TemplateDefinition } from './template';

/** Every template, indexed by id. Adding one means a folder and a line here. */
export const TEMPLATES: TemplateDefinition[] = [classicRed];

export const DEFAULT_TEMPLATE = classicRed;

export function findTemplate(id: string): TemplateDefinition | undefined {
  return TEMPLATES.find((template) => template.id === id);
}

export function getTemplate(id: string): TemplateDefinition {
  const template = findTemplate(id);
  if (!template) throw new ApiError(422, 'VALIDATION_ERROR', 'That template does not exist.');
  return template;
}
