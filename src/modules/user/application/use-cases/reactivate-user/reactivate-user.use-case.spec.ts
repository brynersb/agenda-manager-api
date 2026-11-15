import { ReactivateUserUseCase } from '@/modules/user/application/use-cases/reactivate-user/reactivate-user.use-case';
import { UserStatus } from '@/modules/user/domain/enums/user-status';
import { UserNotFoundError } from '@/modules/user/domain/errors/user.errors';
import {
  ACTOR,
  fakeLogger,
  fakeUserQueryRepository,
  fakeUserRepository,
  fixedClock,
  makeUser,
  readModelOf,
} from '@/modules/user/testing/user.fixtures';

describe('ReactivateUserUseCase', () => {
  const repository = fakeUserRepository();
  const queryRepository = fakeUserQueryRepository();
  const useCase = new ReactivateUserUseCase(
    repository,
    queryRepository,
    fixedClock(),
    fakeLogger(),
  );

  beforeEach(() => {
    vi.clearAllMocks();
    repository.save.mockResolvedValue(undefined);
    queryRepository.findOneById.mockImplementation(async (id) =>
      readModelOf(makeUser({ id })),
    );
  });

  it('reativa, destrava e grava com a versão lida', async () => {
    const user = makeUser({
      id: 'u-9',
      status: UserStatus.DEACTIVATED,
      version: 2,
    });
    repository.findById.mockResolvedValue(user);

    await useCase.execute({ id: 'u-9', actor: ACTOR });

    expect(user.status).toBe(UserStatus.ACTIVE);
    expect(repository.save).toHaveBeenCalledWith(user, 2);
  });

  it('é idempotente: já ativo não grava', async () => {
    repository.findById.mockResolvedValue(makeUser({ id: 'u-9' }));

    await useCase.execute({ id: 'u-9', actor: ACTOR });

    expect(repository.save).not.toHaveBeenCalled();
  });

  it('usuário inexistente dá USER_NOT_FOUND', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ id: 'x', actor: ACTOR }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });
});
