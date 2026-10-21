// Stable error codes and the JSON error envelope from §9, "API rules".

export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'NOT_FOUND',
  'CONFLICT',
  'IDEMPOTENCY_KEY_REQUIRED',
  'JOB_NOT_CANCELLABLE',
  'JOB_NOT_RETRYABLE',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'WORKER_LOST',
  'UNSUPPORTED_JOB_TYPE',
  // Product API
  'FORBIDDEN',
  'PLAN_LIMIT_REACHED',
  'CONSENT_REQUIRED',
  'VERSION_CONFLICT',
  'NOT_CONFIGURED',
  'UNSUPPORTED_FILE_TYPE',
  'FILE_TOO_LARGE',
  'PAYMENT_FAILED',
  'INVALID_SIGNATURE',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ErrorEnvelope {
  error: { code: string; message: string; correlationId: string };
}

export function errorEnvelope(code: string, message: string, correlationId: string): ErrorEnvelope {
  return { error: { code, message, correlationId } };
}

export type JobFailureKind = 'retryable' | 'permanent' | 'needs_user_action';

/**
 * Thrown by job handlers. `safeMessage` is shown to the user, so it must not
 * contain credentials, document contents or provider responses.
 */
export class JobError extends Error {
  constructor(
    public readonly kind: JobFailureKind,
    public readonly code: string,
    public readonly safeMessage: string,
    /** Honors a provider's Retry-After when it is longer than our own backoff. */
    public readonly retryAfterMs?: number,
  ) {
    super(`${code}: ${safeMessage}`);
    this.name = 'JobError';
  }
}
