import { LogoutUseCase } from '@/modules/auth/application/use-cases/logout/logout.use-case';
import {
  fakeTokenService,
  makeRefreshToken,
} from '@/modules/auth/testing/auth.fixtures';
import {
  fakeLogger,
  fakeRefreshTokenRepository,
  fixedClock,
  NOW,
} from '@/modules/user/testing/user.fixtures';

describe('LogoutUseCase', () => {
  const refreshTokens = fakeRefreshTokenRepository();
  const logger = fakeLogger();
  const useCase = new LogoutUseCase(
    fakeTokenService(),
    refreshTokens,
    fixedClock(),
    logger,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('revoga a família do refresh token do próprio usuário', async () => {
    refreshTokens.findByTokenHash.mockResolvedValue(
      makeRefreshToken({ userId: 'user-1', familyId: 'family-2' }),
    );

    await useCase.execute({ userId: 'user-1', refreshToken: 'refresh-x' });

    expect(refreshTokens.findByTokenHash).toHaveBeenCalledWith(
      'hash-of-refresh-x',
    );
    expect(refreshTokens.revokeFamily).toHaveBeenCalledWith('family-2', NOW);
  });

  it('token de outro usuário não revoga nada (e não vaza)', async () => {
    refreshTokens.findByTokenHash.mockResolvedValue(
      makeRefreshToken({ userId: 'outro-usuario' }),
    );

    await expect(
      useCase.execute({ userId: 'user-1', refreshToken: 'refresh-x' }),
    ).resolves.toBeUndefined();

    expect(refreshTokens.revokeFamily).not.toHaveBeenCalled();
  });

  it('token desconhecido termina em silêncio (idempotente)', async () => {
    refreshTokens.findByTokenHash.mockResolvedValue(null);

    await expect(
      useCase.execute({ userId: 'user-1', refreshToken: 'refresh-x' }),
    ).resolves.toBeUndefined();

    expect(refreshTokens.revokeFamily).not.toHaveBeenCalled();
  });

  it('nunca registra o token em log', async () => {
    refreshTokens.findByTokenHash.mockResolvedValue(makeRefreshToken());

    await useCase.execute({ userId: 'user-1', refreshToken: 'refresh-x' });

    expect(logger.allCalls()).not.toContain('refresh-x');
  });
});
