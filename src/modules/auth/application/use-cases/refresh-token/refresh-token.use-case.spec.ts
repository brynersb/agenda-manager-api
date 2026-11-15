import { RefreshTokenUseCase } from '@/modules/auth/application/use-cases/refresh-token/refresh-token.use-case';
import {
  InvalidRefreshTokenError,
  UserDeactivatedError,
} from '@/modules/auth/domain/errors/auth.errors';
import {
  fakeTokenService,
  makeRefreshToken,
  makeSessionIssuer,
} from '@/modules/auth/testing/auth.fixtures';
import { UserStatus } from '@/modules/user/domain/enums/user-status';
import {
  fakeLogger,
  fakeRefreshTokenRepository,
  fakeUserRepository,
  fixedClock,
  makeUser,
  NOW,
} from '@/modules/user/testing/user.fixtures';

describe('RefreshTokenUseCase', () => {
  const users = fakeUserRepository();
  const refreshTokens = fakeRefreshTokenRepository();
  const tokens = fakeTokenService();
  const logger = fakeLogger();
  const clock = fixedClock();
  const useCase = new RefreshTokenUseCase(
    tokens,
    refreshTokens,
    users,
    makeSessionIssuer(tokens, refreshTokens, clock),
    clock,
    logger,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    users.findById.mockResolvedValue(makeUser());
    refreshTokens.rotate.mockResolvedValue(true);
  });

  const input = {
    refreshToken: 'refresh-antigo',
    userAgent: 'Vitest',
    ip: '::1',
  };

  it('rotaciona: grava o novo token na mesma família e devolve um novo par', async () => {
    const current = makeRefreshToken({ id: 'rt-9', familyId: 'family-9' });
    refreshTokens.findByTokenHash.mockResolvedValue(current);

    const session = await useCase.execute(input);

    expect(tokens.hashRefreshToken).toHaveBeenCalledWith('refresh-antigo');
    expect(refreshTokens.findByTokenHash).toHaveBeenCalledWith(
      'hash-of-refresh-antigo',
    );
    const [currentId, next, now] = refreshTokens.rotate.mock.calls[0];
    expect(currentId).toBe('rt-9');
    expect(next).toMatchObject({
      familyId: 'family-9',
      userId: 'user-1',
      tokenHash: 'hash-of-refresh-1',
      userAgent: 'Vitest',
    });
    expect(now).toEqual(NOW);
    expect(session).toMatchObject({
      accessToken: 'access-for-user-1',
      refreshToken: 'refresh-1',
      expiresIn: 900,
      mustChangePassword: false,
    });
    expect(refreshTokens.revokeFamily).not.toHaveBeenCalled();
  });

  it('a sessão renovada reflete o papel atual do banco', async () => {
    refreshTokens.findByTokenHash.mockResolvedValue(makeRefreshToken());
    users.findById.mockResolvedValue(makeUser({ role: 'admin' as never }));

    const session = await useCase.execute(input);

    expect(session.user.role).toBe('admin');
    expect(session.user.permissions).toContain('user:write');
  });

  it('token desconhecido dá INVALID_REFRESH_TOKEN', async () => {
    refreshTokens.findByTokenHash.mockResolvedValue(null);

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
    expect(refreshTokens.rotate).not.toHaveBeenCalled();
    expect(refreshTokens.revokeFamily).not.toHaveBeenCalled();
  });

  it('REUSO: token já revogado derruba a família inteira e é recusado', async () => {
    refreshTokens.findByTokenHash.mockResolvedValue(
      makeRefreshToken({
        id: 'rt-velho',
        familyId: 'family-7',
        revokedAt: new Date(NOW.getTime() - 60_000),
      }),
    );

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );

    expect(refreshTokens.revokeFamily).toHaveBeenCalledWith('family-7', NOW);
    expect(refreshTokens.rotate).not.toHaveBeenCalled();
    expect(tokens.issueAccessToken).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        'evt.name': 'auth.refresh_token_reuse_detected',
        family_id: 'family-7',
      }),
    );
  });

  it('REUSO por corrida: rotação rejeitada pelo banco também derruba a família', async () => {
    refreshTokens.findByTokenHash.mockResolvedValue(
      makeRefreshToken({ familyId: 'family-3' }),
    );
    refreshTokens.rotate.mockResolvedValue(false);

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );

    expect(refreshTokens.revokeFamily).toHaveBeenCalledWith('family-3', NOW);
  });

  it('token expirado dá INVALID_REFRESH_TOKEN sem revogar a família', async () => {
    refreshTokens.findByTokenHash.mockResolvedValue(
      makeRefreshToken({ expiresAt: new Date(NOW.getTime() - 1) }),
    );

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );

    expect(refreshTokens.revokeFamily).not.toHaveBeenCalled();
    expect(refreshTokens.rotate).not.toHaveBeenCalled();
  });

  it('usuário desativado recebe USER_DEACTIVATED e a família é revogada', async () => {
    refreshTokens.findByTokenHash.mockResolvedValue(
      makeRefreshToken({ familyId: 'family-5' }),
    );
    users.findById.mockResolvedValue(
      makeUser({ status: UserStatus.DEACTIVATED }),
    );

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(
      UserDeactivatedError,
    );

    expect(refreshTokens.revokeFamily).toHaveBeenCalledWith('family-5', NOW);
    expect(refreshTokens.rotate).not.toHaveBeenCalled();
  });

  it('usuário que sumiu dá INVALID_REFRESH_TOKEN', async () => {
    refreshTokens.findByTokenHash.mockResolvedValue(makeRefreshToken());
    users.findById.mockResolvedValue(null);

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
  });

  it('nunca registra o token em log', async () => {
    refreshTokens.findByTokenHash.mockResolvedValue(makeRefreshToken());
    await useCase.execute(input);
    refreshTokens.findByTokenHash.mockResolvedValue(null);
    await useCase.execute(input).catch(() => undefined);

    expect(logger.allCalls()).not.toContain('refresh-antigo');
    expect(logger.allCalls()).not.toContain('refresh-1');
    expect(logger.allCalls()).not.toContain('hash-of-');
  });
});
