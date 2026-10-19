import type { JobStep } from '@tracck/shared';
import type { JobHandler } from '../runner';

const STEPS: JobStep[] = ['download_source', 'normalize', 'validate'];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Walks through a few steps and does nothing else. It exists to prove the path
 * from API to queue to worker to progress stream, and is not a product feature.
 */
export const diagnostic: JobHandler = async ({ job, setStep }) => {
  const requested = Number(job.inputRef.stepDelayMs);
  const stepDelayMs = Number.isFinite(requested) ? Math.min(Math.max(requested, 0), 5_000) : 800;

  for (const [index, step] of STEPS.entries()) {
    await setStep(step, Math.round((index / STEPS.length) * 100));
    await sleep(stepDelayMs);
  }

  return { steps: STEPS.length };
};
