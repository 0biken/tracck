import { Global, Module } from '@nestjs/common';
import type { ApiEnv } from '../config/env';
import { notConfigured } from '../common/not-configured';
import { AI_ENGINE, ENV, LLM_CLIENT, USAGE_SINK } from '../tokens';
import { ContextService } from './context.service';
import { EmbeddingSyncService } from './embedding-sync.service';
import { ExampleStore } from './examples';
import { GeminiEngine } from './gemini-engine';
import { GeminiLlm } from './gemini-llm';
import type { LlmClient } from './llm';
import { PlaceholderEngine } from './placeholder-engine';
import { ProfileIndexHandler } from './profile-index.handler';
import { DbUsageSink, type UsageSink } from './usage';

/** Answers 503 NOT_CONFIGURED for every call, so the API starts without a model key. */
const unconfiguredLlm: LlmClient = {
  json: () => notConfigured('The AI engine'),
  embed: () => notConfigured('The AI engine'),
};

/**
 * Binds the AI engine. With GEMINI_API_KEY set the real engine runs; without it the
 * placeholder keeps importing and tagging sources and every model feature answers 503.
 * Nothing else in the API knows which one it is talking to.
 */
@Global()
@Module({
  providers: [
    PlaceholderEngine,
    ExampleStore,
    ContextService,
    EmbeddingSyncService,
    ProfileIndexHandler,
    GeminiEngine,
    DbUsageSink,
    { provide: USAGE_SINK, useExisting: DbUsageSink },
    {
      provide: LLM_CLIENT,
      inject: [ENV, USAGE_SINK],
      useFactory: (env: ApiEnv, usage: UsageSink): LlmClient =>
        env.GEMINI_API_KEY
          ? new GeminiLlm({
              apiKey: env.GEMINI_API_KEY,
              embeddingModel: env.AI_EMBEDDING_MODEL,
              usage,
            })
          : unconfiguredLlm,
    },
    {
      provide: AI_ENGINE,
      inject: [ENV, GeminiEngine, PlaceholderEngine],
      useFactory: (env: ApiEnv, gemini: GeminiEngine, placeholder: PlaceholderEngine) => (env.GEMINI_API_KEY ? gemini : placeholder),
    },
  ],
  exports: [AI_ENGINE, LLM_CLIENT, ContextService, EmbeddingSyncService, ProfileIndexHandler, ExampleStore],
})
export class AiModule {}
