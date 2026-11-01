import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { ApiError } from '@tracck/shared';
import type { ApiRequest } from '../common/api-request';
import type { ApiEnv } from '../config/env';
import { ENV } from '../tokens';

function splitList(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? '')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Whether a user ID or email belongs to the Tracck team. */
export function isStaff(
  env: Pick<ApiEnv, 'STAFF_USER_IDS' | 'STAFF_EMAILS'>,
  userId: string | undefined | null,
  email?: string | undefined | null,
): boolean {
  if (userId && splitList(env.STAFF_USER_IDS).has(userId.toLowerCase())) {
    return true;
  }
  if (email && splitList(env.STAFF_EMAILS).has(email.toLowerCase())) {
    return true;
  }
  return false;
}

/**
 * Allows access only to Tracck staff (listed in STAFF_USER_IDS or STAFF_EMAILS).
 * Must be used after AuthGuard so request.userId and request.userEmail are populated.
 */
@Injectable()
export class StaffGuard implements CanActivate {
  constructor(@Inject(ENV) private readonly env: ApiEnv) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<ApiRequest>();
    if (!isStaff(this.env, request.userId, request.userEmail)) {
      throw new ApiError(403, 'FORBIDDEN', 'This area is for the Tracck team.');
    }
    return true;
  }
}
