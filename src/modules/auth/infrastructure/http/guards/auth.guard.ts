import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';

import { type Env, Stage } from '@/config/env.validation';
import {
  OIDC_TOKEN_SERVICE,
  type TokenFailureReason,
  type TokenVerifierInterface,
} from '@/modules/auth/application/interfaces/token-verifier.interface';
import type { AuthenticatedUser } from '@/modules/auth/application/types/authenticated-user';
import { permissionsOfRoles } from '@/modules/auth/application/types/role-permissions.map';
import type { Role } from '@/modules/auth/domain/enums/role';
import { UnauthenticatedError } from '@/modules/auth/domain/errors/auth.errors';
import { IS_PUBLIC_KEY } from '@/modules/auth/infrastructure/http/decorators/public.decorator';
import type { AuthenticatedRequest } from '@/modules/auth/infrastructure/http/types/authenticated-request';
import type { LoggerServiceInterface } from '@/shared/application/interfaces/logger.service.interface';
import { LOGGER_SERVICE } from '@/shared/application/interfaces/logger.service.interface';
import { requestContext } from '@/shared/infrastructure/http/request-context';

const BEARER_PREFIX = /^Bearer\s+(.+)$/i;

/**
 * Autentica a requisição pelo `Authorization: Bearer <access token>`.
 * `@Public()` libera; o mock de usuário só existe com `STAGE=local` **e**
 * `AUTH_MOCK_ENABLED=true`. Toda recusa vira o mesmo 401 `UNAUTHENTICATED`; o
 * motivo vai só para o log e o token nunca é registrado.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly mockUser: AuthenticatedUser | null = null;

  constructor(
    @Inject(OIDC_TOKEN_SERVICE) private readonly tokens: TokenVerifierInterface,
    @Inject(LOGGER_SERVICE) private readonly logger: LoggerServiceInterface,
    private readonly reflector: Reflector,
    config: ConfigService<Env, true>,
  ) {
    this.logger.setLogPrefix(AuthGuard.name);

    const mockEnabled =
      config.get('STAGE', { infer: true }) === Stage.Local &&
      config.get('AUTH_MOCK_ENABLED', { infer: true });
    if (mockEnabled) {
      const role: Role = config.get('AUTH_MOCK_ROLE', { infer: true });
      this.mockUser = {
        sub: 'mock-user',
        name: 'Usuário Mock',
        email: null,
        roles: [role],
        permissions: permissionsOfRoles([role]),
      };
      this.logger.warn(
        'Autenticação simulada ligada: toda requisição passa como usuário mock',
        {
          'evt.name': 'auth.mock_used',
          outcome: 'success',
          role,
          tags: ['auth', 'mock'],
        },
      );
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (this.mockUser) {
      request.user = this.mockUser;
      return true;
    }

    const token = this.extractToken(request.headers.authorization);
    if (typeof token !== 'string') {
      return this.reject(token.reason);
    }

    const result = await this.tokens.verify(token);
    if (!result.ok) {
      return this.reject(result.reason);
    }

    const { sub, name, email, roles } = result.claims;
    request.user = {
      sub,
      name,
      email,
      roles,
      permissions: permissionsOfRoles(roles),
    };
    return true;
  }

  private extractToken(
    header: string | undefined,
  ): string | { reason: TokenFailureReason } {
    if (!header || header.trim() === '') {
      return { reason: 'token_missing' };
    }
    const token = BEARER_PREFIX.exec(header.trim())?.[1];
    return token ?? { reason: 'invalid_format' };
  }

  private reject(reason: TokenFailureReason): never {
    const unavailable = reason === 'jwks_unavailable';
    const fields = {
      'evt.name': 'auth.guard.rejected',
      outcome: 'blocked',
      reason,
      request_id: requestContext.getStore()?.requestId,
      tags: ['auth', 'guard'],
    };
    if (unavailable) {
      this.logger.error(
        'Requisição recusada: não foi possível obter as chaves do provedor de identidade',
        fields,
      );
    } else {
      this.logger.warn('Requisição não autenticada recusada', fields);
    }
    throw new UnauthenticatedError();
  }
}
