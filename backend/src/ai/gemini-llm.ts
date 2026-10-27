import { GoogleGenAI, ThinkingLevel as GeminiThinking } from '@google/genai';
import { z } from 'zod';
import { EMBEDDING_DIMENSIONS } from '../db/schema';
import { emptyUsage, TokensExhaustedError, type EmbedRequest, type JsonRequest, type JsonResult, type LlmClient, type LlmUsage, type ThinkingLevel } from './llm';
import type { UsageSink } from './usage';

export interface GeminiOptions {
  apiKey: string;
  embeddingModel: string;
  usage: UsageSink;
}

const LEVELS: Record<Exclude<ThinkingLevel, 'off'>, GeminiThinking> = {
  minimal: GeminiThinking.MINIMAL,
  low: GeminiThinking.LOW,
  medium: GeminiThinking.MEDIUM,
  high: GeminiThinking.HIGH,
};

const EMBED_BATCH = 100;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function statusOf(error: unknown): number | undefined {
  return (error as { status?: number })?.status;
}

/** Server errors are worth another try; bad requests are not. */
function transient(error: unknown): boolean {
  const status = statusOf(error);
  return typeof status === 'number' && status >= 500;
}

/**
 * Gemini answers 429 once the project's quota or token allowance is spent. Retrying
 * straight away only spends more of it, so the job is parked for a while instead.
 */
async function withRetry<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      if (statusOf(error) === 429) throw new TokensExhaustedError();
      if (attempt >= 2 || !transient(error)) throw error;
      await sleep(500 * 2 ** attempt);
    }
  }
}

function unit(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / norm);
}

function sum(total: LlmUsage, usage: LlmUsage) {
  total.inputTokens += usage.inputTokens;
  total.outputTokens += usage.outputTokens;
  total.cachedTokens += usage.cachedTokens;
  total.thoughtTokens += usage.thoughtTokens;
}

export class GeminiLlm implements LlmClient {
  private readonly ai: GoogleGenAI;

  constructor(private readonly options: GeminiOptions) {
    this.ai = new GoogleGenAI({ apiKey: options.apiKey });
  }

  async json<T>(request: JsonRequest<T>): Promise<JsonResult<T>> {
    // JSON Schema constrains the model's output; zod then checks it again, because a
    // conforming answer can still be wrong in ways the schema cannot say.
    const { $schema: _ignored, ...jsonSchema } = z.toJSONSchema(request.schema) as Record<string, unknown>;
    const thinking = request.thinking && request.thinking !== 'off' ? LEVELS[request.thinking] : undefined;
    // Thinking tokens count against the output limit, so leave room for them.
    const maxOutputTokens = (request.maxOutputTokens ?? 4096) + (thinking ? 8192 : 0);

    const total = emptyUsage();
    let prompt = request.prompt;

    // At most two tries: the second one repeats the question with what was wrong.
    for (let attempt = 0; ; attempt += 1) {
      const started = Date.now();
      let usage = emptyUsage();
      let status: 'ok' | 'error' | 'refused' | 'truncated' = 'ok';
      let retry: string | null = null;
      try {
        const response = await withRetry(() =>
          this.ai.models.generateContent({
            model: request.model,
            contents: prompt,
            config: {
              systemInstruction: request.system,
              responseMimeType: 'application/json',
              responseJsonSchema: jsonSchema,
              temperature: request.temperature ?? 0.3,
              maxOutputTokens,
              ...(thinking ? { thinkingConfig: { thinkingLevel: thinking } } : {}),
            },
          }),
        );
        const meta = response.usageMetadata;
        usage = {
          inputTokens: meta?.promptTokenCount ?? 0,
          outputTokens: meta?.candidatesTokenCount ?? 0,
          cachedTokens: meta?.cachedContentTokenCount ?? 0,
          thoughtTokens: meta?.thoughtsTokenCount ?? 0,
        };
        sum(total, usage);

        if (response.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
          status = 'truncated';
          throw new Error('The model ran out of output space before finishing.');
        }
        if (!response.text) {
          status = 'refused';
          throw new Error('The model returned no content.');
        }

        let raw: unknown;
        try {
          raw = JSON.parse(response.text);
        } catch {
          status = 'error';
          retry = 'Your previous answer was not valid JSON. Answer again with only the JSON object.';
        }
        if (retry === null) {
          const parsed = request.schema.safeParse(raw);
          if (parsed.success) return { data: parsed.data, usage: total };
          status = 'error';
          retry = `Your previous answer did not match the required format: ${parsed.error.message.slice(0, 600)}\nAnswer again, matching the format exactly.`;
        }
      } catch (error) {
        if (status === 'ok') status = 'error';
        throw error;
      } finally {
        await this.options.usage.record({
          purpose: request.purpose,
          model: request.model,
          usage,
          latencyMs: Date.now() - started,
          status,
          userId: request.userId,
        });
      }

      if (attempt >= 1) throw new Error('The model answer did not match the required format.');
      prompt = `${request.prompt}\n\n${retry}`;
    }
  }

  async embed({ texts, kind, userId }: EmbedRequest): Promise<number[][]> {
    const { embeddingModel: model } = this.options;
    // gemini-embedding-2 has no task type: the task is written into the text instead.
    const newModel = model.includes('embedding-2');
    const prepared = newModel
      ? texts.map((text) => (kind === 'query' ? `task: search result | query: ${text}` : `title: none | text: ${text}`))
      : texts;

    const out: number[][] = [];
    for (let start = 0; start < prepared.length; start += EMBED_BATCH) {
      const started = Date.now();
      const batch = prepared.slice(start, start + EMBED_BATCH);
      const response = await withRetry(() =>
        this.ai.models.embedContent({
          model,
          contents: batch,
          config: {
            outputDimensionality: EMBEDDING_DIMENSIONS,
            ...(newModel ? {} : { taskType: kind === 'query' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT' }),
          },
        }),
      );
      const vectors = response.embeddings ?? [];
      if (vectors.length !== batch.length) throw new Error('The embedding model returned the wrong number of vectors.');
      // Truncated outputs are not unit length on every model, and cosine search assumes it.
      for (const vector of vectors) out.push(unit(vector.values ?? []));
      await this.options.usage.record({
        purpose: 'embed',
        model,
        usage: { ...emptyUsage(), inputTokens: batch.reduce((total, text) => total + Math.ceil(text.length / 4), 0) },
        latencyMs: Date.now() - started,
        status: 'ok',
        userId,
      });
    }
    return out;
  }
}
