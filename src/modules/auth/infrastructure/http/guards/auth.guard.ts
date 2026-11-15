import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import {
  TOKEN_SERVICE,
  type TokenFailureReason,
  type TokenServiceInterface,
} from '@/modules/auth/application/interfaces/token.service.interface';
import { UnauthenticatedError } from '@/modules/auth/domain/errors/auth.errors';
import { permissionsOfRole } from '@/modules/auth/domain/services/role-permissions';
import { IS_PUBLIC_KEY } from '@/modules/auth/infrastructure/http/decorators/public.decorator';
import type { AuthenticatedRequest } from '@/modules/auth/infrastructure/http/types/authenticated-request';
import type { LoggerServiceInterface } from '@/shared/application/interfaces/logger.service.interface';
import { LOGGER_SERVICE } from '@/shared/application/interfaces/logger.service.interface';
import { requestContext } from '@/shared/infrastructure/http/request-context';

const BEARER_PREFIX = /^Bearer\s+(.+)$/i;

type RejectionReason = TokenFailureReason | 'token_missing';

/**
 * Autentica a requisição pelo `Authorization: Bearer <access token>`.
 * `@Public()` libera. O token é validado localmente (assinatura HS256, `iss`,
 * `aud`, expiração): o usuário vem das claims e **não há consulta ao banco por
 * requisição**. Consequência (ADR-016): desativar um usuário ou trocar o papel
 * dele só vale nos tokens novos, no máximo `JWT_ACCESS_TTL` depois (padrão
 * 15 min). As permissões saem do papel no servidor, nunca do token. Toda
 * recusa vira o mesmo 401 `UNAUTHENTICATED`; o motivo vai só para o log e o
 * token nunca é registrado.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenServiceInterface,
    @Inject(LOGGER_SERVICE) private readonly logger: LoggerServiceInterface,
    private readonly reflector: Reflector,
  ) {
    this.logger.setLogPrefix(AuthGuard.name);
  }

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const token = this.extractToken(request.headers.authorization);
    if (token === null) {
      return this.reject('token_missing');
    }

    const result = this.tokens.verifyAccessToken(token);
    if (!result.ok) {
      return this.reject(result.reason);
    }

    const { id, name, email, role } = result.claims;
    request.user = {
      id,
      name,
      email,
      role,
      permissions: permissionsOfRole(role),
    };
    return true;
  }

  private extractToken(header: string | undefined): string | null {
    if (!header || header.trim() === '') {
      return null;
    }
    return BEARER_PREFIX.exec(header.trim())?.[1] ?? null;
  }

  private reject(reason: RejectionReason): never {
    this.logger.warn('Requisição não autenticada recusada', {
      'evt.name': 'auth.guard.rejected',
      outcome: 'blocked',
      reason,
      request_id: requestContext.getStore()?.requestId,
      tags: ['auth', 'guard'],
    });
    throw new UnauthenticatedError();
  }
}
