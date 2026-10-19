// Bounded exponential backoff with jitter (§7.3).

export interface BackoffOptions {
  baseMs?: number;
  maxMs?: number;
  /** Returns a number in [0, 1). Injected so tests are deterministic. */
  random?: () => number;
}

/**
 * Delay before attempt `attempt + 1`, given that `attempt` attempts have run.
 * Half the delay is fixed and half is jittered, so retries spread out without
 * ever firing immediately.
 */
export function backoffMs(attempt: number, options: BackoffOptions = {}): number {
  const { baseMs = 5_000, maxMs = 5 * 60_000, random = Math.random } = options;
  const exponential = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt - 1));
  return Math.round(exponential * (0.5 + random() * 0.5));
}

export function hasAttemptsLeft(attemptCount: number, maxAttempts: number): boolean {
  return attemptCount < maxAttempts;
}
