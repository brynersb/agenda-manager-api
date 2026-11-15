import { ChangePasswordUseCase } from '@/modules/auth/application/use-cases/change-password/change-password.use-case';
import {
  InvalidCurrentPasswordError,
  UnauthenticatedError,
  UserDeactivatedError,
} from '@/modules/auth/domain/errors/auth.errors';
import {
  fakeTokenService,
  makeSessionIssuer,
} from '@/modules/auth/testing/auth.fixtures';
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
  const tokens = fakeTokenService();
  const clock = fixedClock();
  const useCase = new ChangePasswordUseCase(
    users,
    refreshTokens,
    hasher,
    makeSessionIssuer(tokens, refreshTokens, clock),
    clock,
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
    refreshTokens.create.mockResolvedValue(undefined);
  });

  it('troca a senha, limpa mustChangePassword e revoga todas as sessões', async () => {
    const user = makeUser({ mustChangePassword: true, version: 8 });
    users.findById.mockResolvedValue(user);

    const session = await useCase.execute({
      ...input,
      ip: '10.0.0.1',
      userAgent: 'vitest',
    });

    expect(user.passwordHash).toBe('hashed:nova-senha-forte-456');
    expect(user.mustChangePassword).toBe(false);
    expect(user.audit).toMatchObject({ updatedBy: 'user-1', updatedAt: NOW });
    expect(users.save).toHaveBeenCalledWith(user, 8);
    expect(refreshTokens.revokeAllByUserId).toHaveBeenCalledWith('user-1', NOW);
    expect(session).toMatchObject({
      accessToken: 'access-for-user-1',
      refreshToken: 'refresh-1',
      expiresIn: 900,
      mustChangePassword: false,
      user: { id: 'user-1' },
    });
  });

  it('devolve sessão nova sem mcp: o access token é emitido sem senha provisória pendente', async () => {
    users.findById.mockResolvedValue(makeUser({ mustChangePassword: true }));

    await useCase.execute(input);

    expect(tokens.issueAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({ mustChangePassword: false }),
    );
    expect(refreshTokens.create).toHaveBeenCalledTimes(1);
    expect(
      refreshTokens.revokeAllByUserId.mock.invocationCallOrder[0],
    ).toBeLessThan(refreshTokens.create.mock.invocationCallOrder[0]);
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
    expect(refreshTokens.create).not.toHaveBeenCalled();
    expect(tokens.issueAccessToken).not.toHaveBeenCalled();
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
