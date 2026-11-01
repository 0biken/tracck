import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { ApiError } from '@tracck/shared';
import type { ApiRequest } from '../common/api-request';
import type { Database } from '../db';
import { profiles } from '../db/schema';
import { DB, VERIFY_TOKEN } from '../tokens';
import { bearerToken, type VerifyToken } from './token-verifier';

/**
 * Lets a request through only with a valid Supabase access token, and records
 * who it is on the request. The user ID always comes from the verified token,
 * never from the body or the URL. Suspended accounts are refused with 403.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(VERIFY_TOKEN) private readonly verifyToken: VerifyToken,
    @Inject(DB) private readonly db: Database,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<ApiRequest>();
    const { userId, email } = await this.verifyToken(bearerToken(request.headers.authorization));
    const [profile] = await this.db
      .select({ suspendedAt: profiles.suspendedAt })
      .from(profiles)
      .where(eq(profiles.id, userId));
    if (profile?.suspendedAt) {
      throw new ApiError(403, 'ACCOUNT_SUSPENDED', 'Your account has been suspended. Contact support for help.');
    }
    request.userId = userId;
    request.userEmail = email ?? null;
    return true;
  }
}
