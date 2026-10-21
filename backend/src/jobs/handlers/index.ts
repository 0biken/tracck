import type { JobType } from '@tracck/shared';
import type { JobHandler } from '../runner';
import { diagnostic } from './diagnostic';

/**
 * One handler per job type. To add a job: write a handler in this folder, add its
 * type to `JOB_TYPES` in `@tracck/shared`, and register it here. The runner and
 * queue need no changes.
 */
export const jobHandlers: Partial<Record<JobType, JobHandler>> = {
  diagnostic,
};
