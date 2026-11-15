import type { ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';

import type { Env } from '@/config/env.validation';
import type {
  TokenVerifierInterface,
  VerificationResult,
} from '@/modules/auth/application/interfaces/token-verifier.interface';
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

function createConfig(values: Partial<Record<keyof Env, unknown>>) {
  return {
    get: (key: keyof Env) => values[key],
  } as unknown as ConfigService<Env, true>;
}

describe('AuthGuard', () => {
  const verify = vi.fn<TokenVerifierInterface['verify']>();
  const logger = {
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    setLogPrefix: vi.fn(),
  };
  const reflector = new Reflector();

  function create(
    config: Partial<Record<keyof Env, unknown>> = { STAGE: 'e2e' },
  ) {
    return new AuthGuard({ verify }, logger, reflector, createConfig(config));
  }

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

  it('libera rota @Public sem consultar o token', async () => {
    const { ctx } = context(PublicRoute);

    await expect(create().canActivate(ctx)).resolves.toBe(true);
    expect(verify).not.toHaveBeenCalled();
  });

  it('com Bearer válido, anexa o usuário com as permissões do mapa', async () => {
    verify.mockResolvedValue({
      ok: true,
      claims: {
        sub: 'u-1',
        name: 'Maria',
        email: 'maria@x.test',
        roles: [Role.Viewer],
      },
    });
    const { ctx, request } = context(ProtectedRoute, {
      authorization: `Bearer ${SECRET_TOKEN}`,
    });

    await expect(create().canActivate(ctx)).resolves.toBe(true);

    expect(verify).toHaveBeenCalledWith(SECRET_TOKEN);
    expect(request.user).toEqual({
      sub: 'u-1',
      name: 'Maria',
      email: 'maria@x.test',
      roles: [Role.Viewer],
      permissions: ['content-brief:read', 'registry:read'],
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('aceita "bearer" em minúsculas', async () => {
    verify.mockResolvedValue({
      ok: true,
      claims: { sub: 'u-1', name: null, email: null, roles: [] },
    });
    const { ctx } = context(ProtectedRoute, { authorization: 'bearer abc' });

    await expect(create().canActivate(ctx)).resolves.toBe(true);
    expect(verify).toHaveBeenCalledWith('abc');
  });

  it.each([
    ['sem cabeçalho', {}, 'token_missing'],
    ['cabeçalho vazio', { authorization: '  ' }, 'token_missing'],
    [
      'esquema Basic',
      { authorization: `Basic ${SECRET_TOKEN}` },
      'invalid_format',
    ],
    ['Bearer sem token', { authorization: 'Bearer' }, 'invalid_format'],
  ])(
    'recusa %s com 401 UNAUTHENTICATED e log warn',
    async (_name, headers, reason) => {
      const { ctx } = context(ProtectedRoute, headers);

      const error = await create()
        .canActivate(ctx)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(UnauthenticatedError);
      expect(error).toBeInstanceOf(UnauthorizedError);
      expect(error).toMatchObject({
        code: 'UNAUTHENTICATED',
        message: 'Não autenticado.',
      });
      expect(verify).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          'evt.name': 'auth.guard.rejected',
          outcome: 'blocked',
          reason,
        }),
      );
      expect(allLogs()).not.toContain(SECRET_TOKEN);
      expect(allLogs().toLowerCase()).not.toContain('authorization');
    },
  );

  it.each([
    'invalid_signature',
    'expired',
    'invalid_issuer',
    'invalid_audience',
    'invalid_format',
  ] as const)('motivo %s do serviço vira 401 com log warn', async (reason) => {
    verify.mockResolvedValue({ ok: false, reason } as VerificationResult);
    const { ctx } = context(ProtectedRoute, {
      authorization: `Bearer ${SECRET_TOKEN}`,
    });

    await expect(create().canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );

    expect(logger.warn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ 'evt.name': 'auth.guard.rejected', reason }),
    );
    expect(logger.error).not.toHaveBeenCalled();
    expect(allLogs()).not.toContain(SECRET_TOKEN);
  });

  it('jwks_unavailable vira 401 com log de nível error', async () => {
    verify.mockResolvedValue({ ok: false, reason: 'jwks_unavailable' });
    const { ctx } = context(ProtectedRoute, {
      authorization: `Bearer ${SECRET_TOKEN}`,
    });

    await expect(create().canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );

    expect(logger.error).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        'evt.name': 'auth.guard.rejected',
        reason: 'jwks_unavailable',
      }),
    );
    expect(logger.warn).not.toHaveBeenCalled();
    expect(allLogs()).not.toContain(SECRET_TOKEN);
  });

  it('inclui o request_id do contexto da requisição no log', async () => {
    const { ctx } = context(ProtectedRoute);

    await requestContext.run({ requestId: 'req-123' }, async () => {
      await create()
        .canActivate(ctx)
        .catch(() => undefined);
    });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ request_id: 'req-123' }),
    );
  });

  describe('usuário mock', () => {
    it('com STAGE=local e AUTH_MOCK_ENABLED, autentica sem token e avisa uma vez no boot', async () => {
      const guard = create({
        STAGE: 'local',
        AUTH_MOCK_ENABLED: true,
        AUTH_MOCK_ROLE: Role.Viewer,
      });
      const { ctx, request } = context(ProtectedRoute);

      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      await expect(guard.canActivate(ctx)).resolves.toBe(true);

      expect(request.user).toMatchObject({
        sub: 'mock-user',
        roles: [Role.Viewer],
        permissions: ['content-brief:read', 'registry:read'],
      });
      expect(verify).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ 'evt.name': 'auth.mock_used' }),
      );
    });

    it.each(['e2e', 'demo'])(
      'com STAGE=%s o mock não vale, mesmo ligado',
      async (stage) => {
        const guard = create({
          STAGE: stage,
          AUTH_MOCK_ENABLED: true,
          AUTH_MOCK_ROLE: Role.Editor,
        });
        const { ctx } = context(ProtectedRoute);

        await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
          UnauthenticatedError,
        );
        expect(logger.warn).not.toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ 'evt.name': 'auth.mock_used' }),
        );
      },
    );

    it('com STAGE=local e mock desligado exige token', async () => {
      const guard = create({ STAGE: 'local', AUTH_MOCK_ENABLED: false });
      const { ctx } = context(ProtectedRoute);

      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
        UnauthenticatedError,
      );
    });
  });
});
