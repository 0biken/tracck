// The model boundary. The engine asks for validated JSON and for embeddings and does
// not know which provider answers, so a provider (or a test fake) is one class.

import type { z } from 'zod';

export type ThinkingLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high';

/** What a call was for. Used for cost reporting and to pick a model. */
export type LlmPurpose = 'extract' | 'write' | 'check' | 'embed';

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  /** Input tokens served from the provider's prompt cache (billed at a lower rate). */
  cachedTokens: number;
  thoughtTokens: number;
}

export interface JsonRequest<T> {
  purpose: Exclude<LlmPurpose, 'embed'>;
  model: string;
  /** Stable text first (rules, examples): providers cache prompt prefixes. */
  system: string;
  /** Per-request text: the job, the person's evidence. */
  prompt: string;
  schema: z.ZodType<T>;
  thinking?: ThinkingLevel;
  maxOutputTokens?: number;
  temperature?: number;
  userId?: string;
}

export interface JsonResult<T> {
  data: T;
  usage: LlmUsage;
}

export interface EmbedRequest {
  texts: string[];
  /** Documents are stored; queries are what we search with. Some models embed them differently. */
  kind: 'document' | 'query';
  userId?: string;
}

export interface LlmClient {
  json<T>(request: JsonRequest<T>): Promise<JsonResult<T>>;
  embed(request: EmbedRequest): Promise<number[][]>;
}

export const emptyUsage = (): LlmUsage => ({ inputTokens: 0, outputTokens: 0, cachedTokens: 0, thoughtTokens: 0 });
