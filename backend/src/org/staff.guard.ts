import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { ApiError } from '@tracck/shared';
import type { ApiRequest } from '../common/api-request';
import type { ApiEnv } from '../config/env';
import { ENV } from '../tokens';

/** The people who run Tracck. Listed by user ID in STAFF_USER_IDS; nobody else can reach the console. Use after AuthGuard. */
@Injectable()
export class StaffGuard implements CanActivate {
  private readonly staff: Set<string>;

  constructor(@Inject(ENV) env: ApiEnv) {
    this.staff = new Set((env.STAFF_USER_IDS ?? '').split(',').map((id) => id.trim().toLowerCase()).filter(Boolean));
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<ApiRequest>();
    if (!request.userId || !this.staff.has(request.userId.toLowerCase())) {
      throw new ApiError(403, 'FORBIDDEN', 'This area is for the Tracck team.');
    }
    return true;
  }
}

export const isStaff = (env: Pick<ApiEnv, 'STAFF_USER_IDS'>, userId: string) =>
  (env.STAFF_USER_IDS ?? '').split(',').map((id) => id.trim().toLowerCase()).includes(userId.toLowerCase());
