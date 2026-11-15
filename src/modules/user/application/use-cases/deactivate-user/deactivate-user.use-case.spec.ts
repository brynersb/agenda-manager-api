import { Role } from '@/modules/auth/domain/enums/role';
import { DeactivateUserUseCase } from '@/modules/user/application/use-cases/deactivate-user/deactivate-user.use-case';
import { UserStatus } from '@/modules/user/domain/enums/user-status';
import {
  CannotModifySelfError,
  LastAdminError,
  UserNotFoundError,
} from '@/modules/user/domain/errors/user.errors';
import {
  ACTOR,
  fakeLogger,
  fakeRefreshTokenRepository,
  fakeUserQueryRepository,
  fakeUserRepository,
  fixedClock,
  makeUser,
  NOW,
  readModelOf,
} from '@/modules/user/testing/user.fixtures';

describe('DeactivateUserUseCase', () => {
  const repository = fakeUserRepository();
  const queryRepository = fakeUserQueryRepository();
  const refreshTokens = fakeRefreshTokenRepository();
  const useCase = new DeactivateUserUseCase(
    repository,
    queryRepository,
    refreshTokens,
    fixedClock(),
    fakeLogger(),
  );

  beforeEach(() => {
    vi.clearAllMocks();
    repository.save.mockResolvedValue(undefined);
    repository.countActiveAdminsExcluding.mockResolvedValue(1);
    queryRepository.findOneById.mockImplementation(async (id) =>
      readModelOf(makeUser({ id })),
    );
  });

  it('desativa, grava com a versão lida e revoga todas as sessões', async () => {
    const user = makeUser({ id: 'u-9', version: 7 });
    repository.findById.mockResolvedValue(user);

    await useCase.execute({ id: 'u-9', actor: ACTOR });

    expect(user.status).toBe(UserStatus.DEACTIVATED);
    expect(user.audit).toMatchObject({ updatedBy: ACTOR.id, updatedAt: NOW });
    expect(repository.save).toHaveBeenCalledWith(user, 7);
    expect(refreshTokens.revokeAllByUserId).toHaveBeenCalledWith('u-9', NOW);
  });

  it('não pode desativar a si mesmo (CANNOT_MODIFY_SELF)', async () => {
    repository.findById.mockResolvedValue(makeUser({ id: ACTOR.id }));

    await expect(
      useCase.execute({ id: ACTOR.id, actor: ACTOR }),
    ).rejects.toBeInstanceOf(CannotModifySelfError);
    expect(repository.save).not.toHaveBeenCalled();
    expect(refreshTokens.revokeAllByUserId).not.toHaveBeenCalled();
  });

  it('não desativa o último administrador ativo (LAST_ADMIN)', async () => {
    repository.findById.mockResolvedValue(
      makeUser({ id: 'u-admin', role: Role.Admin }),
    );
    repository.countActiveAdminsExcluding.mockResolvedValue(0);

    await expect(
      useCase.execute({ id: 'u-admin', actor: ACTOR }),
    ).rejects.toBeInstanceOf(LastAdminError);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('desativa um admin quando sobra outro', async () => {
    const admin = makeUser({ id: 'u-admin', role: Role.Admin });
    repository.findById.mockResolvedValue(admin);

    await useCase.execute({ id: 'u-admin', actor: ACTOR });

    expect(admin.status).toBe(UserStatus.DEACTIVATED);
  });

  it('é idempotente: já desativado não grava nem revoga de novo', async () => {
    repository.findById.mockResolvedValue(
      makeUser({ id: 'u-9', status: UserStatus.DEACTIVATED }),
    );

    await useCase.execute({ id: 'u-9', actor: ACTOR });

    expect(repository.save).not.toHaveBeenCalled();
    expect(refreshTokens.revokeAllByUserId).not.toHaveBeenCalled();
  });

  it('usuário inexistente dá USER_NOT_FOUND', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ id: 'x', actor: ACTOR }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });
});
