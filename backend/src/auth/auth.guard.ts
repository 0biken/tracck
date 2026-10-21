import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { ApiRequest } from '../common/api-request';
import { VERIFY_TOKEN } from '../tokens';
import { bearerToken, type VerifyToken } from './token-verifier';

/**
 * Lets a request through only with a valid Supabase access token, and records
 * who it is on the request. The user ID always comes from the verified token,
 * never from the body or the URL.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(VERIFY_TOKEN) private readonly verifyToken: VerifyToken) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<ApiRequest>();
    const { userId, email } = await this.verifyToken(bearerToken(request.headers.authorization));
    request.userId = userId;
    request.userEmail = email ?? null;
    return true;
  }
}
