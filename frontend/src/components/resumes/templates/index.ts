import type { ComponentType } from 'react'
import { ClassicRed, type TemplateProps } from './classic-red'

/** The renderer for each template id the API can return. Keep in step with the backend registry. */
export const TEMPLATE_RENDERERS: Record<string, ComponentType<TemplateProps>> = {
  'classic-red': ClassicRed,
}
