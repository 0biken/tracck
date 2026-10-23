import { Inject, Injectable } from '@nestjs/common';
import type { Database } from '../db';
import { llmCalls } from '../db/schema';
import { DB } from '../tokens';
import type { LlmPurpose, LlmUsage } from './llm';

export interface UsageRecord {
  purpose: LlmPurpose;
  model: string;
  usage: LlmUsage;
  latencyMs: number;
  status: 'ok' | 'error' | 'timeout' | 'refused' | 'truncated';
  userId?: string;
  generationRunId?: string;
}

export interface UsageSink {
  record(entry: UsageRecord): Promise<void>;
}

/** Writes metadata to `llm_calls` (tokens, latency, status). Prompt text is never stored. */
@Injectable()
export class DbUsageSink implements UsageSink {
  constructor(@Inject(DB) private readonly db: Database) {}

  async record(entry: UsageRecord): Promise<void> {
    try {
      await this.db.insert(llmCalls).values({
        generationRunId: entry.generationRunId ?? null,
        userId: entry.userId ?? null,
        role: entry.purpose,
        provider: 'google',
        model: entry.model,
        inputTokens: entry.usage.inputTokens,
        // Thinking tokens are billed as output.
        outputTokens: entry.usage.outputTokens + entry.usage.thoughtTokens,
        latencyMs: entry.latencyMs,
        status: entry.status,
      });
    } catch {
      // Cost reporting must never fail a resume.
    }
  }
}

export const noUsageSink: UsageSink = { record: async () => {} };
