import { Role } from '@/modules/auth/domain/enums/role';
import {
  BOOTSTRAP_ACTOR,
  BootstrapAdminUseCase,
} from '@/modules/user/application/use-cases/bootstrap-admin/bootstrap-admin.use-case';
import {
  EmailAlreadyRegisteredError,
  InvalidUserEmailError,
  WeakPasswordError,
} from '@/modules/user/domain/errors/user.errors';
import {
  fakeHasher,
  fakeLogger,
  fakeUserRepository,
  fixedClock,
  NOW,
} from '@/modules/user/testing/user.fixtures';

describe('BootstrapAdminUseCase', () => {
  const repository = fakeUserRepository();
  const hasher = fakeHasher();
  const logger = fakeLogger();
  const useCase = new BootstrapAdminUseCase(
    repository,
    hasher,
    fixedClock(),
    logger,
  );
  const config = {
    email: 'Admin@Pauta.Local',
    password: 'senha-inicial-123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    repository.count.mockResolvedValue(0);
    repository.save.mockResolvedValue(undefined);
  });

  it('sem nenhum usuário e com e-mail e senha, cria o admin com troca obrigatória', async () => {
    await expect(useCase.execute(config)).resolves.toBe('created');

    const saved = repository.save.mock.calls[0][0];
    expect(saved).toMatchObject({
      role: Role.Admin,
      mustChangePassword: true,
      passwordHash: 'hashed:senha-inicial-123',
    });
    expect(saved.email.value).toBe('admin@pauta.local');
    expect(saved.audit).toMatchObject({
      createdBy: BOOTSTRAP_ACTOR.id,
      createdAt: NOW,
    });
  });

  it('registra o e-mail e nunca a senha', async () => {
    await useCase.execute(config);

    expect(logger.info).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        'evt.name': 'user.bootstrap_admin',
        outcome: 'success',
        email: 'admin@pauta.local',
      }),
    );
    expect(logger.allCalls()).not.toContain('senha-inicial-123');
    expect(logger.allCalls()).not.toContain('hashed:');
  });

  it('é idempotente: com qualquer usuário existente, não cria nada', async () => {
    repository.count.mockResolvedValue(1);

    await expect(useCase.execute(config)).resolves.toBe('users_exist');

    expect(repository.save).not.toHaveBeenCalled();
    expect(hasher.hash).not.toHaveBeenCalled();
  });

  it.each([
    [{}],
    [{ email: 'admin@pauta.local' }],
    [{ password: 'senha-inicial-123' }],
    [{ email: '', password: '' }],
  ])(
    'sem configuração completa (%o), só avisa com clareza',
    async (partial) => {
      await expect(useCase.execute(partial)).resolves.toBe('not_configured');

      expect(repository.save).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('BOOTSTRAP_ADMIN_EMAIL'),
        expect.objectContaining({ reason: 'not_configured' }),
      );
    },
  );

  it('recusa e-mail ou senha inválidos', async () => {
    await expect(
      useCase.execute({ ...config, email: 'sem-arroba' }),
    ).rejects.toBeInstanceOf(InvalidUserEmailError);
    await expect(
      useCase.execute({ ...config, password: 'curta' }),
    ).rejects.toBeInstanceOf(WeakPasswordError);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('duas instâncias subindo juntas: a perdedora do índice único não falha', async () => {
    repository.save.mockRejectedValue(new EmailAlreadyRegisteredError());

    await expect(useCase.execute(config)).resolves.toBe('users_exist');
  });
});
