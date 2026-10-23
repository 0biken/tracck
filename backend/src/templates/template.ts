import type { RoleId } from '@tracck/shared';

/**
 * A resume layout Tracck can render. The template decides the examples the writer learns
 * from, the rules the formatter follows, and the layout the frontend draws, so a template
 * is added as a folder plus one registry line.
 */
export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  /** Absolute path of the preview image shown in the template picker. */
  previewPath: string;
  /** Rules for the formatter: how the finished resume maps onto this layout. */
  formatterRules: string;
  /** One sample resume per role, in this template's tone and structure. Dummy content until real examples exist. */
  examples: Record<RoleId, string>;
}
