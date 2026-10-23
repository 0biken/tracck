import { ApiError } from '@tracck/shared';

/** A 429 that also tells the caller when to try again, in the `Retry-After` header. */
export class RateLimitedError extends ApiError {
  constructor(
    message: string,
    public readonly retryAfterSeconds: number,
  ) {
    super(429, 'RATE_LIMITED', message);
    this.name = 'RateLimitedError';
  }
}
