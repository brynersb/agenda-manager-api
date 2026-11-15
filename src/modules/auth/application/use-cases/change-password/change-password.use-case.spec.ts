import { ChangePasswordUseCase } from '@/modules/auth/application/use-cases/change-password/change-password.use-case';
import {
  InvalidCurrentPasswordError,
  UnauthenticatedError,
  UserDeactivatedError,
} from '@/modules/auth/domain/errors/auth.errors';
import { UserStatus } from '@/modules/user/domain/enums/user-status';
import { WeakPasswordError } from '@/modules/user/domain/errors/user.errors';
import {
  fakeHasher,
  fakeLogger,
  fakeRefreshTokenRepository,
  fakeUserRepository,
  fixedClock,
  makeUser,
  NOW,
} from '@/modules/user/testing/user.fixtures';

describe('ChangePasswordUseCase', () => {
  const users = fakeUserRepository();
  const refreshTokens = fakeRefreshTokenRepository();
  const hasher = fakeHasher();
  const logger = fakeLogger();
  const useCase = new ChangePasswordUseCase(
    users,
    refreshTokens,
    hasher,
    fixedClock(),
    logger,
  );

  const input = {
    userId: 'user-1',
    currentPassword: 'senha-correta-123',
    newPassword: 'nova-senha-forte-456',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    users.save.mockResolvedValue(undefined);
  });

  it('troca a senha, limpa mustChangePassword e revoga todas as sessões', async () => {
    const user = makeUser({ mustChangePassword: true, version: 8 });
    users.findById.mockResolvedValue(user);

    await useCase.execute(input);

    expect(user.passwordHash).toBe('hashed:nova-senha-forte-456');
    expect(user.mustChangePassword).toBe(false);
    expect(user.audit).toMatchObject({ updatedBy: 'user-1', updatedAt: NOW });
    expect(users.save).toHaveBeenCalledWith(user, 8);
    expect(refreshTokens.revokeAllByUserId).toHaveBeenCalledWith('user-1', NOW);
  });

  it('senha atual errada dá INVALID_CURRENT_PASSWORD (400) sem alterar nada', async () => {
    users.findById.mockResolvedValue(makeUser());

    const error = await useCase
      .execute({ ...input, currentPassword: 'outra-senha-000' })
      .catch((e) => e);

    expect(error).toBeInstanceOf(InvalidCurrentPasswordError);
    expect(error).toMatchObject({
      code: 'INVALID_CURRENT_PASSWORD',
      kind: 'VALIDATION',
    });
    expect(users.save).not.toHaveBeenCalled();
    expect(refreshTokens.revokeAllByUserId).not.toHaveBeenCalled();
  });

  it('nova senha fora da política dá WEAK_PASSWORD', async () => {
    users.findById.mockResolvedValue(makeUser());

    await expect(
      useCase.execute({ ...input, newPassword: 'curta' }),
    ).rejects.toBeInstanceOf(WeakPasswordError);
    expect(users.save).not.toHaveBeenCalled();
  });

  it('nova senha igual à atual dá WEAK_PASSWORD', async () => {
    users.findById.mockResolvedValue(makeUser());

    await expect(
      useCase.execute({ ...input, newPassword: input.currentPassword }),
    ).rejects.toMatchObject({
      code: 'WEAK_PASSWORD',
      message: 'A nova senha deve ser diferente da atual.',
    });
    expect(users.save).not.toHaveBeenCalled();
  });

  it('usuário que não existe mais dá UNAUTHENTICATED', async () => {
    users.findById.mockResolvedValue(null);

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
  });

  it('usuário desativado dá USER_DEACTIVATED', async () => {
    users.findById.mockResolvedValue(
      makeUser({ status: UserStatus.DEACTIVATED }),
    );

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(
      UserDeactivatedError,
    );
  });

  it('nunca registra senhas em log', async () => {
    users.findById.mockResolvedValue(makeUser());
    await useCase.execute(input);
    users.findById.mockResolvedValue(makeUser());
    await useCase
      .execute({ ...input, currentPassword: 'errada-000000' })
      .catch(() => undefined);

    for (const secret of [
      'senha-correta-123',
      'nova-senha-forte-456',
      'errada-000000',
    ]) {
      expect(logger.allCalls()).not.toContain(secret);
    }
  });
});
