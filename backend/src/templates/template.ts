import type { PersonalDetail, RoleId, TemplateSectionId, TemplateSectionView } from '@tracck/shared';
import type { EvidenceType } from '../ai/ai-engine';

/** A section of a template: what it is for, and the kinds of evidence it draws on. */
export interface TemplateSection extends TemplateSectionView {
  /** Evidence types this section draws on, most useful first. */
  evidence: EvidenceType[];
}

/** One line of a sample resume and what it does for the reader. The writer copies the move, never the facts. */
export interface SampleLine {
  section: TemplateSectionId;
  text: string;
  /** What this line does for the reader, in one sentence. */
  intent: string;
}

/**
 * A resume layout Tracck can render. The template decides its sections and what each one is for,
 * the personal details it shows, the samples the writer learns from, and how the formatter chooses
 * content. The frontend draws it with a matching renderer. See the resume-template skill to add one.
 */
export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  /** Absolute path of the preview image shown in the template picker. */
  previewPath: string;
  sections: TemplateSection[];
  /** The personal details shown on the header, in order. */
  details: PersonalDetail[];
  /** How the formatter chooses from the resume. What each section is for is already in `sections`. */
  formatterRules: string;
  /** One sample per role, each line with its intent. */
  samples: Record<RoleId, SampleLine[]>;
}
