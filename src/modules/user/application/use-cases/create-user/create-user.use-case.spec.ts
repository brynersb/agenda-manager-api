import { Role } from '@/modules/auth/domain/enums/role';
import { CreateUserUseCase } from '@/modules/user/application/use-cases/create-user/create-user.use-case';
import {
  EmailAlreadyRegisteredError,
  InvalidUserEmailError,
  InvalidUserNameError,
  WeakPasswordError,
} from '@/modules/user/domain/errors/user.errors';
import {
  ACTOR,
  fakeHasher,
  fakeLogger,
  fakeUserQueryRepository,
  fakeUserRepository,
  fixedClock,
  makeUser,
  NOW,
  readModelOf,
} from '@/modules/user/testing/user.fixtures';

describe('CreateUserUseCase', () => {
  const repository = fakeUserRepository();
  const queryRepository = fakeUserQueryRepository();
  const hasher = fakeHasher();
  const passwordGenerator = { generate: vi.fn(() => 'Gerada-Forte-123') };
  const logger = fakeLogger();
  const useCase = new CreateUserUseCase(
    repository,
    queryRepository,
    hasher,
    passwordGenerator,
    fixedClock(),
    logger,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    repository.findByEmail.mockResolvedValue(null);
    repository.save.mockResolvedValue(undefined);
    queryRepository.findOneById.mockImplementation(async (id) =>
      readModelOf(makeUser({ id })),
    );
  });

  const input = {
    name: '  Ana   Lima ',
    email: ' Ana.Lima@Pauta.Local ',
    role: Role.Viewer,
    actor: ACTOR,
  };

  it('sem senha, gera a provisória, grava só o hash e a devolve uma vez', async () => {
    const result = await useCase.execute(input);

    expect(result.temporaryPassword).toBe('Gerada-Forte-123');
    expect(hasher.hash).toHaveBeenCalledWith('Gerada-Forte-123');
    const saved = repository.save.mock.calls[0][0];
    expect(saved).toMatchObject({
      role: Role.Viewer,
      mustChangePassword: true,
      passwordHash: 'hashed:Gerada-Forte-123',
    });
    expect(saved.name.value).toBe('Ana Lima');
    expect(saved.email.value).toBe('ana.lima@pauta.local');
    expect(saved.audit).toMatchObject({ createdBy: ACTOR.id, createdAt: NOW });
    expect(repository.save.mock.calls[0]).toHaveLength(1);
  });

  it('com senha informada, não gera nem devolve senha, mas exige troca', async () => {
    const result = await useCase.execute({
      ...input,
      password: 'senha-do-admin-1',
    });

    expect(result.temporaryPassword).toBeNull();
    expect(passwordGenerator.generate).not.toHaveBeenCalled();
    expect(repository.save.mock.calls[0][0]).toMatchObject({
      passwordHash: 'hashed:senha-do-admin-1',
      mustChangePassword: true,
    });
  });

  it('recusa senha informada fora da política (WEAK_PASSWORD) sem gravar', async () => {
    await expect(
      useCase.execute({ ...input, password: 'curta' }),
    ).rejects.toBeInstanceOf(WeakPasswordError);

    expect(repository.save).not.toHaveBeenCalled();
  });

  it('recusa e-mail já cadastrado, ativo ou desativado (EMAIL_ALREADY_REGISTERED)', async () => {
    repository.findByEmail.mockResolvedValue(makeUser());

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(
      EmailAlreadyRegisteredError,
    );

    expect(repository.findByEmail).toHaveBeenCalledWith('ana.lima@pauta.local');
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('trata a corrida no índice único como e-mail já cadastrado', async () => {
    repository.save.mockRejectedValue(new EmailAlreadyRegisteredError());

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(
      EmailAlreadyRegisteredError,
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ reason: 'email_already_registered' }),
    );
  });

  it.each([
    [{ email: 'sem-arroba' }, InvalidUserEmailError],
    [{ name: '   ' }, InvalidUserNameError],
  ])('valida entradas %o', async (override, error) => {
    await expect(
      useCase.execute({ ...input, ...override }),
    ).rejects.toBeInstanceOf(error);
  });

  it('nunca registra a senha nem o e-mail em log', async () => {
    await useCase.execute({ ...input, password: 'senha-do-admin-1' });
    await useCase.execute(input);

    expect(logger.allCalls()).not.toContain('senha-do-admin-1');
    expect(logger.allCalls()).not.toContain('Gerada-Forte-123');
    expect(logger.allCalls()).not.toContain('ana.lima@pauta.local');
    expect(logger.info).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        'evt.name': 'user.created',
        outcome: 'success',
      }),
    );
  });
});
