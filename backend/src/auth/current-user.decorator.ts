import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { ApiRequest } from '../common/api-request';

/** The signed-in user's ID. Use on routes behind `AuthGuard`. */
export const UserId = createParamDecorator((_data: unknown, context: ExecutionContext): string =>
  context.switchToHttp().getRequest<ApiRequest>().userId!,
);
