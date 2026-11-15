import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { AuthenticatedUser } from '@/modules/auth/application/types/authenticated-user';
import { UnauthenticatedError } from '@/modules/auth/domain/errors/auth.errors';
import type { AuthenticatedRequest } from '@/modules/auth/infrastructure/http/types/authenticated-request';

/** Entrega o `AuthenticatedUser` resolvido pelo `AuthGuard`. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!user) {
      throw new UnauthenticatedError();
    }
    return user;
  },
);
