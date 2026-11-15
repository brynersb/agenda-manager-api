import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { Permission } from '@/modules/auth/domain/enums/permission';
import {
  ForbiddenAccessError,
  UnauthenticatedError,
} from '@/modules/auth/domain/errors/auth.errors';
import { AUTHENTICATED_KEY } from '@/modules/auth/infrastructure/http/decorators/authenticated.decorator';
import { PERMISSIONS_KEY } from '@/modules/auth/infrastructure/http/decorators/permissions.decorator';
import { IS_PUBLIC_KEY } from '@/modules/auth/infrastructure/http/decorators/public.decorator';
import type { AuthenticatedRequest } from '@/modules/auth/infrastructure/http/types/authenticated-request';
import type { LoggerServiceInterface } from '@/shared/application/interfaces/logger.service.interface';
import { LOGGER_SERVICE } from '@/shared/application/interfaces/logger.service.interface';

/**
 * Autoriza por permissão e **nega por padrão**: rota não pública sem
 * `@Permissions(...)` nem `@Authenticated()` recebe 403 e gera um log, de modo
 * que esquecer o decorator nunca deixa a rota aberta (ADR-013).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(LOGGER_SERVICE) private readonly logger: LoggerServiceInterface,
  ) {
    this.logger.setLogPrefix(PermissionsGuard.name);
  }

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];

    if (
      this.reflector.getAllAndOverride<boolean | undefined>(
        IS_PUBLIC_KEY,
        targets,
      )
    ) {
      return true;
    }

    const required = this.reflector.getAllAndOverride<Permission[] | undefined>(
      PERMISSIONS_KEY,
      targets,
    );
    const onlyAuthenticated = this.reflector.getAllAndOverride<
      boolean | undefined
    >(AUTHENTICATED_KEY, targets);
    const hasRequirement = required !== undefined && required.length > 0;

    if (!hasRequirement && !onlyAuthenticated) {
      this.logger.warn(
        'Rota sem @Permissions, @Authenticated ou @Public: acesso negado por padrão',
        {
          'evt.name': 'auth.permissions.missing_decorator',
          outcome: 'blocked',
          controller: context.getClass().name,
          handler: context.getHandler().name,
          tags: ['auth', 'permissions'],
        },
      );
      throw new ForbiddenAccessError();
    }

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!user) {
      throw new UnauthenticatedError();
    }

    if (
      hasRequirement &&
      !required.every((p) => user.permissions.includes(p))
    ) {
      this.logger.warn('Permissão negada', {
        'evt.name': 'auth.permissions.denied',
        outcome: 'blocked',
        user_sub: user.id,
        required_permissions: required,
        tags: ['auth', 'permissions'],
      });
      throw new ForbiddenAccessError();
    }

    return true;
  }
}
