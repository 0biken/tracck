// The model and tuning for each AI task. Models are chosen here, in code, so a change is
// reviewed and tested like any other. Keys and endpoints stay in .env.

import type { ThinkingLevel } from './llm';

export interface AiSettings {
  writer: { model: string; thinking: ThinkingLevel };
  critic: { model: string; thinking: ThinkingLevel };
  extract: { model: string };
  embedding: { model: string };
  /** Critic passes before the writer's draft is accepted. 0 skips the review loop. */
  maxRevisions: number;
  /** Entries the writer sees, after retrieval. */
  evidenceLimit: number;
}

export const AI_CONFIG: AiSettings = {
  /** Writes and revises the resume. */
  writer: { model: 'gemini-3.8-flash', thinking: 'off' },
  /** Reviews the draft. A different model from the writer gives an independent check. */
  critic: { model: 'gemini-3.8-flash', thinking: 'low' },
  /** Reads sources and job descriptions into structured data. A small, cheap model is enough. */
  extract: { model: 'gemini-3.5-flash-lite' },
  /** Turns entries into vectors. Its output size is EMBEDDING_DIMENSIONS in db/schema.ts. */
  embedding: { model: 'gemini-embedding-001' },
  maxRevisions: 2,
  evidenceLimit: 40,
};
