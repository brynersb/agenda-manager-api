import { Role } from '@/modules/auth/domain/enums/role';
import { UpdateUserUseCase } from '@/modules/user/application/use-cases/update-user/update-user.use-case';
import { UserStatus } from '@/modules/user/domain/enums/user-status';
import {
  CannotModifySelfError,
  InvalidUserNameError,
  LastAdminError,
  UserNotFoundError,
  UserVersionOutdatedError,
} from '@/modules/user/domain/errors/user.errors';
import {
  ACTOR,
  fakeLogger,
  fakeUserQueryRepository,
  fakeUserRepository,
  fixedClock,
  makeUser,
  NOW,
  readModelOf,
} from '@/modules/user/testing/user.fixtures';

describe('UpdateUserUseCase', () => {
  const repository = fakeUserRepository();
  const queryRepository = fakeUserQueryRepository();
  const useCase = new UpdateUserUseCase(
    repository,
    queryRepository,
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

  it('altera nome e papel e grava com a versão esperada', async () => {
    const user = makeUser({ id: 'u-9', version: 4 });
    repository.findById.mockResolvedValue(user);

    await useCase.execute({
      id: 'u-9',
      name: '  Maria  Lima ',
      role: Role.Viewer,
      version: 4,
      actor: ACTOR,
    });

    expect(user.name.value).toBe('Maria Lima');
    expect(user.role).toBe(Role.Viewer);
    expect(user.audit).toMatchObject({ updatedBy: ACTOR.id, updatedAt: NOW });
    expect(repository.save).toHaveBeenCalledWith(user, 4);
  });

  it('recusa quando nenhum campo vem no corpo', async () => {
    await expect(
      useCase.execute({ id: 'u-9', version: 1, actor: ACTOR }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST', kind: 'VALIDATION' });
    expect(repository.findById).not.toHaveBeenCalled();
  });

  it('usuário inexistente dá USER_NOT_FOUND', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ id: 'x', name: 'A', version: 1, actor: ACTOR }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });

  it('versão divergente dá USER_VERSION_OUTDATED sem gravar', async () => {
    repository.findById.mockResolvedValue(makeUser({ version: 5 }));

    await expect(
      useCase.execute({ id: 'user-1', name: 'A', version: 4, actor: ACTOR }),
    ).rejects.toBeInstanceOf(UserVersionOutdatedError);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('nome inválido é recusado antes de ler o banco', async () => {
    await expect(
      useCase.execute({ id: 'u', name: '  ', version: 1, actor: ACTOR }),
    ).rejects.toBeInstanceOf(InvalidUserNameError);
  });

  it('não pode mudar o próprio papel (CANNOT_MODIFY_SELF)', async () => {
    repository.findById.mockResolvedValue(
      makeUser({ id: ACTOR.id, role: Role.Admin, version: 2 }),
    );

    await expect(
      useCase.execute({
        id: ACTOR.id,
        role: Role.Viewer,
        version: 2,
        actor: ACTOR,
      }),
    ).rejects.toBeInstanceOf(CannotModifySelfError);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('pode mudar o próprio nome e reenviar o próprio papel', async () => {
    const self = makeUser({ id: ACTOR.id, role: Role.Admin, version: 2 });
    repository.findById.mockResolvedValue(self);

    await useCase.execute({
      id: ACTOR.id,
      name: 'Novo Nome',
      role: Role.Admin,
      version: 2,
      actor: ACTOR,
    });

    expect(self.name.value).toBe('Novo Nome');
    expect(repository.save).toHaveBeenCalled();
  });

  it('não rebaixa o último administrador ativo (LAST_ADMIN)', async () => {
    repository.findById.mockResolvedValue(
      makeUser({ id: 'u-admin', role: Role.Admin, version: 1 }),
    );
    repository.countActiveAdminsExcluding.mockResolvedValue(0);

    await expect(
      useCase.execute({
        id: 'u-admin',
        role: Role.Editor,
        version: 1,
        actor: ACTOR,
      }),
    ).rejects.toBeInstanceOf(LastAdminError);
    expect(repository.countActiveAdminsExcluding).toHaveBeenCalledWith(
      'u-admin',
    );
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('rebaixa um admin quando sobra outro', async () => {
    const admin = makeUser({ id: 'u-admin', role: Role.Admin, version: 1 });
    repository.findById.mockResolvedValue(admin);

    await useCase.execute({
      id: 'u-admin',
      role: Role.Editor,
      version: 1,
      actor: ACTOR,
    });

    expect(admin.role).toBe(Role.Editor);
  });

  it('mudar o papel de um admin desativado não é protegido pela regra', async () => {
    const admin = makeUser({
      id: 'u-admin',
      role: Role.Admin,
      status: UserStatus.DEACTIVATED,
      version: 1,
    });
    repository.findById.mockResolvedValue(admin);
    repository.countActiveAdminsExcluding.mockResolvedValue(0);

    await useCase.execute({
      id: 'u-admin',
      role: Role.Viewer,
      version: 1,
      actor: ACTOR,
    });

    expect(admin.role).toBe(Role.Viewer);
  });

  it('propaga a rede de segurança do repositório contra corrida (LAST_ADMIN)', async () => {
    repository.findById.mockResolvedValue(
      makeUser({ id: 'u-admin', role: Role.Admin, version: 1 }),
    );
    repository.save.mockRejectedValue(new LastAdminError());

    await expect(
      useCase.execute({
        id: 'u-admin',
        role: Role.Editor,
        version: 1,
        actor: ACTOR,
      }),
    ).rejects.toBeInstanceOf(LastAdminError);
  });
});
