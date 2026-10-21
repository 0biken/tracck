import { ApiError } from '@tracck/shared';

/**
 * Thrown when a feature's integration settings are missing. The rest of the API
 * keeps working; only this feature answers 503.
 */
export function notConfigured(feature: string): never {
  throw new ApiError(503, 'NOT_CONFIGURED', `${feature} is not set up on this server yet.`);
}
