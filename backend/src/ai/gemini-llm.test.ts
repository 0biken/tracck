import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { GeminiLlm } from './gemini-llm';
import { isTokensExhausted, TOKENS_RETRY_MS } from './llm';
import { noUsageSink } from './usage';

describe('GeminiLlm when the token allowance is used up', () => {
  it('parks the call as a retryable job error instead of retrying at once', async () => {
    const llm = new GeminiLlm({ apiKey: 'test', embeddingModel: 'test-embedding', usage: noUsageSink });
    const generateContent = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('RESOURCE_EXHAUSTED'), { status: 429 }));
    (llm as unknown as { ai: { models: { generateContent: typeof generateContent } } }).ai.models.generateContent =
      generateContent;

    const error = await llm
      .json({ purpose: 'write', model: 'test-model', system: 'system', prompt: 'prompt', schema: z.object({}) })
      .catch((caught: unknown) => caught);

    expect(isTokensExhausted(error)).toBe(true);
    expect(error).toMatchObject({ kind: 'retryable', code: 'AI_TOKENS_EXHAUSTED', retryAfterMs: TOKENS_RETRY_MS });
    expect(generateContent).toHaveBeenCalledTimes(1);
  });
});
