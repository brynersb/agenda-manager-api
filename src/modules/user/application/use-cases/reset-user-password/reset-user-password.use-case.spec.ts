import { ResetUserPasswordUseCase } from '@/modules/user/application/use-cases/reset-user-password/reset-user-password.use-case';
import { UserNotFoundError } from '@/modules/user/domain/errors/user.errors';
import {
  ACTOR,
  fakeHasher,
  fakeLogger,
  fakeRefreshTokenRepository,
  fakeUserQueryRepository,
  fakeUserRepository,
  fixedClock,
  makeUser,
  NOW,
  readModelOf,
} from '@/modules/user/testing/user.fixtures';

describe('ResetUserPasswordUseCase', () => {
  const repository = fakeUserRepository();
  const queryRepository = fakeUserQueryRepository();
  const refreshTokens = fakeRefreshTokenRepository();
  const hasher = fakeHasher();
  const passwordGenerator = { generate: vi.fn(() => 'Provisoria-Forte-9') };
  const logger = fakeLogger();
  const useCase = new ResetUserPasswordUseCase(
    repository,
    queryRepository,
    refreshTokens,
    hasher,
    passwordGenerator,
    fixedClock(),
    logger,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    repository.save.mockResolvedValue(undefined);
    queryRepository.findOneById.mockImplementation(async (id) =>
      readModelOf(makeUser({ id })),
    );
  });

  it('gera senha provisória, exige troca, grava só o hash e revoga as sessões', async () => {
    const user = makeUser({
      id: 'u-9',
      version: 6,
      mustChangePassword: false,
      failedLoginAttempts: 2,
    });
    repository.findById.mockResolvedValue(user);

    const result = await useCase.execute({ id: 'u-9', actor: ACTOR });

    expect(result.temporaryPassword).toBe('Provisoria-Forte-9');
    expect(user.passwordHash).toBe('hashed:Provisoria-Forte-9');
    expect(user.mustChangePassword).toBe(true);
    expect(user.failedLoginAttempts).toBe(0);
    expect(user.audit).toMatchObject({ updatedBy: ACTOR.id, updatedAt: NOW });
    expect(repository.save).toHaveBeenCalledWith(user, 6);
    expect(refreshTokens.revokeAllByUserId).toHaveBeenCalledWith('u-9', NOW);
  });

  it('nunca registra a senha em log', async () => {
    repository.findById.mockResolvedValue(makeUser({ id: 'u-9' }));

    await useCase.execute({ id: 'u-9', actor: ACTOR });

    expect(logger.allCalls()).not.toContain('Provisoria-Forte-9');
  });

  it('usuário inexistente dá USER_NOT_FOUND e não gera senha', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ id: 'x', actor: ACTOR }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
    expect(passwordGenerator.generate).not.toHaveBeenCalled();
    expect(refreshTokens.revokeAllByUserId).not.toHaveBeenCalled();
  });
});
