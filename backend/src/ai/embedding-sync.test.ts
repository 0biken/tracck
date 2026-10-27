import { describe, expect, it } from 'vitest';
import { ApiError, JobError } from '@tracck/shared';
import type { ApiEnv } from '../config/env';
import type { JobDispatcher, DispatchInput } from '../core/job-dispatcher.service';
import type { Database } from '../db';
import type { JobContext } from '../jobs/runner';
import { ContextService } from './context.service';
import { EmbeddingSyncService, INDEX_MAX_ATTEMPTS } from './embedding-sync.service';
import { ProfileIndexHandler } from './profile-index.handler';

const env = (geminiKey?: string) => ({ GEMINI_API_KEY: geminiKey }) as unknown as ApiEnv;

/** A database whose only query finds the given number of active runs. */
const activeRuns = (count: number) => ({ execute: async () => ({ rows: Array.from({ length: count }, () => ({ '?column?': 1 })) }) }) as unknown as Database;

function dispatcher(sent: DispatchInput[]) {
  return {
    dispatch: async (input: DispatchInput) => {
      sent.push(input);
      return { job: {}, created: true };
    },
  } as unknown as JobDispatcher;
}

describe('embedding sync', () => {
  it('queues nothing when no model is configured', async () => {
    const sent: DispatchInput[] = [];
    await new EmbeddingSyncService(activeRuns(0), env(), dispatcher(sent), {} as never).schedule('user-1');
    expect(sent).toHaveLength(0);
  });

  it('queues one run with retries, and none while a run is already waiting or running', async () => {
    const sent: DispatchInput[] = [];
    await new EmbeddingSyncService(activeRuns(0), env('key'), dispatcher(sent), {} as never).schedule('user-1');
    expect(sent).toEqual([
      expect.objectContaining({ userId: 'user-1', jobType: 'profile_index', maxAttempts: INDEX_MAX_ATTEMPTS }),
    ]);

    const busy: DispatchInput[] = [];
    await new EmbeddingSyncService(activeRuns(1), env('key'), dispatcher(busy), {} as never).schedule('user-1');
    expect(busy).toHaveLength(0);
  });

  it('retries a failed embedding, and fails for good when the model is not set up', async () => {
    const context = (error: unknown) => ({ index: async () => Promise.reject(error) }) as unknown as ContextService;
    const jobContext = { job: { userId: 'user-1' } } as unknown as JobContext;

    const down = new ProfileIndexHandler(context(new Error('model down')));
    await expect(down.handle(jobContext)).rejects.toMatchObject({ kind: 'retryable', code: 'EMBEDDING_FAILED' });

    const unset = new ProfileIndexHandler(context(new ApiError(503, 'NOT_CONFIGURED', 'The AI engine is not set up.')));
    const rejected = await unset.handle(jobContext).catch((error: unknown) => error);
    expect(rejected).toBeInstanceOf(JobError);
    expect(rejected).toMatchObject({ kind: 'permanent', code: 'NOT_CONFIGURED' });
  });
});
