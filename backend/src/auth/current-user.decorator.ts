import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { ApiRequest } from '../common/api-request';

/** The signed-in user's ID. Use on routes behind `AuthGuard`. */
export const UserId = createParamDecorator((_data: unknown, context: ExecutionContext): string =>
  context.switchToHttp().getRequest<ApiRequest>().userId!,
);

/** The signed-in user's email, as in their access token. */
export const UserEmail = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | null =>
    context.switchToHttp().getRequest<ApiRequest>().userEmail ?? null,
);

/** The caller's address, for audit records and rate limits. */
export const ClientIp = createParamDecorator((_data: unknown, context: ExecutionContext): string | null => {
  const request = context.switchToHttp().getRequest<ApiRequest>();
  const forwarded = request.headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
  return first || request.ip || null;
});
