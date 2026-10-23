import { z } from 'zod';
import { ApiError } from '@tracck/shared';

const key = z.string().min(8).max(200);

/** Every request that starts work carries a key, so a retry never starts it twice. */
export function requireIdempotencyKey(raw: unknown): string {
  const parsed = key.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Send an Idempotency-Key header with this request.');
  }
  return parsed.data;
}
