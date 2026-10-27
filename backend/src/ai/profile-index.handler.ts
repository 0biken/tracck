import { Inject, Injectable } from '@nestjs/common';
import { ApiError, JobError } from '@tracck/shared';
import type { JobHandler } from '../jobs/runner';
import { ContextService } from './context.service';

/** Runs the index for one person as a job. A failed embedding is retried; a missing model is not. */
@Injectable()
export class ProfileIndexHandler {
  constructor(@Inject(ContextService) private readonly context: ContextService) {}

  handle: JobHandler = async (ctx) => {
    try {
      return await this.context.index(ctx.job.userId);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'NOT_CONFIGURED') {
        throw new JobError('permanent', 'NOT_CONFIGURED', 'The AI engine is not set up, so the record cannot be indexed.');
      }
      throw new JobError('retryable', 'EMBEDDING_FAILED', 'We could not prepare your record for matching. We will try again.');
    }
  };
}
