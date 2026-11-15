import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type {
  TokenFailureReason,
  TokenServiceInterface,
} from '@/modules/auth/application/interfaces/token.service.interface';
import { Role } from '@/modules/auth/domain/enums/role';
import { UnauthenticatedError } from '@/modules/auth/domain/errors/auth.errors';
import { Public } from '@/modules/auth/infrastructure/http/decorators/public.decorator';
import { AuthGuard } from '@/modules/auth/infrastructure/http/guards/auth.guard';
import type { AuthenticatedRequest } from '@/modules/auth/infrastructure/http/types/authenticated-request';
import { UnauthorizedError } from '@/shared/domain/errors/domain-error';
import { requestContext } from '@/shared/infrastructure/http/request-context';

const SECRET_TOKEN = 'eyJ.token-que-nunca-pode-vazar.assinatura';

class ProtectedRoute {
  handler() {}
}

class PublicRoute {
  @Public()
  handler() {}
}

function context(
  target: new () => object,
  headers: Record<string, string> = {},
): { ctx: ExecutionContext; request: AuthenticatedRequest } {
  const request = { headers } as unknown as AuthenticatedRequest;
  const ctx = {
    getHandler: () => target.prototype.handler,
    getClass: () => target,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { ctx, request };
}

describe('AuthGuard', () => {
  const verifyAccessToken = vi.fn<TokenServiceInterface['verifyAccessToken']>();
  const tokens = { verifyAccessToken } as unknown as TokenServiceInterface;
  const logger = {
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    setLogPrefix: vi.fn(),
  };
  const guard = new AuthGuard(tokens, logger, new Reflector());

  function allLogs(): string {
    return JSON.stringify([
      logger.log.mock.calls,
      logger.info.mock.calls,
      logger.warn.mock.calls,
      logger.error.mock.calls,
      logger.debug.mock.calls,
    ]);
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('libera rota @Public sem consultar o token', () => {
    const { ctx } = context(PublicRoute);

    expect(guard.canActivate(ctx)).toBe(true);
    expect(verifyAccessToken).not.toHaveBeenCalled();
  });

  it('com Bearer válido, anexa o usuário com as permissões derivadas do papel', () => {
    verifyAccessToken.mockReturnValue({
      ok: true,
      claims: {
        id: 'u-1',
        name: 'Maria',
        email: 'maria@x.test',
        role: Role.Viewer,
      },
    });
    const { ctx, request } = context(ProtectedRoute, {
      authorization: `Bearer ${SECRET_TOKEN}`,
    });

    expect(guard.canActivate(ctx)).toBe(true);

    expect(verifyAccessToken).toHaveBeenCalledWith(SECRET_TOKEN);
    expect(request.user).toEqual({
      id: 'u-1',
      name: 'Maria',
      email: 'maria@x.test',
      role: Role.Viewer,
      permissions: ['content-brief:read', 'registry:read'],
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('o admin ganha todas as permissões, inclusive user:*', () => {
    verifyAccessToken.mockReturnValue({
      ok: true,
      claims: { id: 'u-2', name: 'A', email: 'a@x.test', role: Role.Admin },
    });
    const { ctx, request } = context(ProtectedRoute, {
      authorization: 'Bearer abc',
    });

    guard.canActivate(ctx);

    expect(request.user?.permissions).toEqual(
      expect.arrayContaining(['user:read', 'user:write']),
    );
  });

  it('aceita "bearer" em minúsculas', () => {
    verifyAccessToken.mockReturnValue({
      ok: true,
      claims: { id: 'u-1', name: 'M', email: 'm@x.test', role: Role.Editor },
    });
    const { ctx } = context(ProtectedRoute, { authorization: 'bearer abc' });

    expect(guard.canActivate(ctx)).toBe(true);
    expect(verifyAccessToken).toHaveBeenCalledWith('abc');
  });

  it.each([
    ['sem cabeçalho', {}],
    ['cabeçalho vazio', { authorization: '  ' }],
    ['esquema Basic', { authorization: `Basic ${SECRET_TOKEN}` }],
    ['Bearer sem token', { authorization: 'Bearer' }],
  ])('recusa %s com 401 UNAUTHENTICATED e log warn', (_name, headers) => {
    const { ctx } = context(ProtectedRoute, headers);

    const error = (() => {
      try {
        guard.canActivate(ctx);
      } catch (e) {
        return e;
      }
    })();

    expect(error).toBeInstanceOf(UnauthenticatedError);
    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(error).toMatchObject({
      code: 'UNAUTHENTICATED',
      message: 'Não autenticado.',
    });
    expect(verifyAccessToken).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        'evt.name': 'auth.guard.rejected',
        outcome: 'blocked',
        reason: 'token_missing',
      }),
    );
    expect(allLogs()).not.toContain(SECRET_TOKEN);
    expect(allLogs().toLowerCase()).not.toContain('authorization');
  });

  it.each([
    'invalid_signature',
    'expired',
    'invalid_issuer',
    'invalid_audience',
    'invalid_format',
    'invalid_claims',
  ] as TokenFailureReason[])(
    'motivo %s do serviço vira 401 com log warn e sem vazar o token',
    (reason) => {
      verifyAccessToken.mockReturnValue({ ok: false, reason });
      const { ctx } = context(ProtectedRoute, {
        authorization: `Bearer ${SECRET_TOKEN}`,
      });

      expect(() => guard.canActivate(ctx)).toThrow(UnauthenticatedError);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ 'evt.name': 'auth.guard.rejected', reason }),
      );
      expect(logger.error).not.toHaveBeenCalled();
      expect(allLogs()).not.toContain(SECRET_TOKEN);
    },
  );

  it('inclui o request_id do contexto da requisição no log', () => {
    const { ctx } = context(ProtectedRoute);

    requestContext.run({ requestId: 'req-123' }, () => {
      try {
        guard.canActivate(ctx);
      } catch {
        // esperado: sem token
      }
    });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ request_id: 'req-123' }),
    );
  });
});
