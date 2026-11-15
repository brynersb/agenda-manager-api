import { LoginUseCase } from '@/modules/auth/application/use-cases/login/login.use-case';
import { Role } from '@/modules/auth/domain/enums/role';
import {
  AccountLockedError,
  InvalidCredentialsError,
  UserDeactivatedError,
} from '@/modules/auth/domain/errors/auth.errors';
import {
  fakeTokenService,
  makeSessionIssuer,
} from '@/modules/auth/testing/auth.fixtures';
import { UserStatus } from '@/modules/user/domain/enums/user-status';
import {
  fakeHasher,
  fakeLogger,
  fakeRefreshTokenRepository,
  fakeUserRepository,
  fixedClock,
  makeUser,
  NOW,
} from '@/modules/user/testing/user.fixtures';
import { UnauthorizedError } from '@/shared/domain/errors/domain-error';

const POLICY = { maxAttempts: 3, lockMinutes: 15 };
const minutesLater = (minutes: number) =>
  new Date(NOW.getTime() + minutes * 60_000);

describe('LoginUseCase', () => {
  const users = fakeUserRepository();
  const refreshTokens = fakeRefreshTokenRepository();
  const hasher = fakeHasher();
  const tokens = fakeTokenService();
  const logger = fakeLogger();
  const clock = fixedClock();
  const useCase = new LoginUseCase(
    users,
    hasher,
    makeSessionIssuer(tokens, refreshTokens, clock),
    clock,
    POLICY,
    logger,
  );

  const credentials = {
    email: '  Maria@Pauta.Local ',
    password: 'senha-correta-123',
  };

  /** `updateLoginState` do repositório: aplica `mutate` no usuário em memória. */
  function mockLoginState(user: ReturnType<typeof makeUser>) {
    users.updateLoginState.mockImplementation(async (_id, mutate) => {
      mutate(user);
      return user;
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sucesso', () => {
    it('devolve tokens, permissões do papel e mustChangePassword', async () => {
      const user = makeUser({
        role: Role.Viewer,
        mustChangePassword: true,
        failedLoginAttempts: 2,
      });
      users.findByEmail.mockResolvedValue(user);
      mockLoginState(user);

      const session = await useCase.execute({
        ...credentials,
        userAgent: 'Vitest',
        ip: '10.0.0.1',
      });

      expect(users.findByEmail).toHaveBeenCalledWith('maria@pauta.local');
      expect(session).toEqual({
        accessToken: 'access-for-user-1',
        refreshToken: 'refresh-1',
        expiresIn: 900,
        mustChangePassword: true,
        user: {
          id: 'user-1',
          email: 'maria@pauta.local',
          name: 'Maria Souza',
          role: Role.Viewer,
          permissions: ['content-brief:read', 'registry:read'],
        },
      });
      expect(tokens.issueAccessToken).toHaveBeenCalledWith(
        expect.objectContaining({ mustChangePassword: true }),
      );
    });

    it('zera o contador de falhas e registra o último login', async () => {
      const user = makeUser({ failedLoginAttempts: 2 });
      users.findByEmail.mockResolvedValue(user);
      mockLoginState(user);

      await useCase.execute(credentials);

      expect(user.failedLoginAttempts).toBe(0);
      expect(user.lastLoginAt).toEqual(NOW);
    });

    it('grava só o hash do refresh token, com TTL, família nova e contexto', async () => {
      const user = makeUser();
      users.findByEmail.mockResolvedValue(user);
      mockLoginState(user);

      await useCase.execute({ ...credentials, userAgent: 'Vitest', ip: '::1' });

      const stored = refreshTokens.create.mock.calls[0][0];
      expect(stored).toMatchObject({
        userId: 'user-1',
        tokenHash: 'hash-of-refresh-1',
        userAgent: 'Vitest',
        ip: '::1',
        expiresAt: new Date(NOW.getTime() + 7 * 24 * 3600 * 1000),
      });
      expect(JSON.stringify(stored)).not.toContain('"refresh-1"');
    });

    it('login com bloqueio já vencido funciona', async () => {
      const user = makeUser({ lockedUntil: minutesLater(-1) });
      users.findByEmail.mockResolvedValue(user);
      mockLoginState(user);

      await expect(useCase.execute(credentials)).resolves.toBeDefined();
      expect(user.lockedUntil).toBeNull();
    });
  });

  describe('credenciais inválidas', () => {
    it('e-mail inexistente: mesma resposta, gasta o tempo de uma verificação', async () => {
      users.findByEmail.mockResolvedValue(null);

      const error = await useCase.execute(credentials).catch((e) => e);

      expect(error).toBeInstanceOf(InvalidCredentialsError);
      expect(error).toBeInstanceOf(UnauthorizedError);
      expect(hasher.burnVerification).toHaveBeenCalledWith(
        credentials.password,
      );
      expect(hasher.verify).not.toHaveBeenCalled();
      expect(users.updateLoginState).not.toHaveBeenCalled();
    });

    it('senha errada: mesma resposta e mesma mensagem do e-mail inexistente', async () => {
      const user = makeUser();
      users.findByEmail.mockResolvedValue(user);
      mockLoginState(user);
      const wrongPassword = await useCase
        .execute({ ...credentials, password: 'senha-errada-000' })
        .catch((e) => e);

      users.findByEmail.mockResolvedValue(null);
      const unknownEmail = await useCase.execute(credentials).catch((e) => e);

      expect(wrongPassword).toBeInstanceOf(InvalidCredentialsError);
      expect(wrongPassword).toMatchObject({
        code: unknownEmail.code,
        kind: unknownEmail.kind,
        message: unknownEmail.message,
      });
      expect(wrongPassword.code).toBe('INVALID_CREDENTIALS');
    });

    it('senha errada conta a falha sem bloquear antes do limite', async () => {
      const user = makeUser();
      users.findByEmail.mockResolvedValue(user);
      mockLoginState(user);

      await expect(
        useCase.execute({ ...credentials, password: 'errada-000000' }),
      ).rejects.toBeInstanceOf(InvalidCredentialsError);

      expect(user.failedLoginAttempts).toBe(1);
      expect(user.isLockedAt(NOW)).toBe(false);
      expect(refreshTokens.create).not.toHaveBeenCalled();
    });

    it('a falha que atinge o limite bloqueia a conta, ainda responde INVALID_CREDENTIALS e avisa no log', async () => {
      const user = makeUser({ failedLoginAttempts: 2 });
      users.findByEmail.mockResolvedValue(user);
      mockLoginState(user);

      await expect(
        useCase.execute({ ...credentials, password: 'errada-000000' }),
      ).rejects.toBeInstanceOf(InvalidCredentialsError);

      expect(user.lockedUntil).toEqual(minutesLater(15));
      expect(logger.warn).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          'evt.name': 'auth.account_locked',
          lock_minutes: 15,
        }),
      );
    });
  });

  describe('conta bloqueada', () => {
    it('responde ACCOUNT_LOCKED com os minutos restantes, sem nem conferir a senha', async () => {
      users.findByEmail.mockResolvedValue(
        makeUser({ lockedUntil: minutesLater(10) }),
      );

      const error = await useCase.execute(credentials).catch((e) => e);

      expect(error).toBeInstanceOf(AccountLockedError);
      expect(error).toMatchObject({
        code: 'ACCOUNT_LOCKED',
        kind: 'FORBIDDEN',
      });
      expect(error.message).toContain('10 minutos');
      expect(hasher.verify).not.toHaveBeenCalled();
      expect(users.updateLoginState).not.toHaveBeenCalled();
    });

    it('mesmo com a senha certa continua bloqueada até o fim do prazo', async () => {
      users.findByEmail.mockResolvedValue(
        makeUser({ lockedUntil: minutesLater(1) }),
      );

      const error = await useCase.execute(credentials).catch((e) => e);

      expect(error).toBeInstanceOf(AccountLockedError);
      expect(error.message).toContain('1 minuto.');
    });
  });

  describe('usuário desativado', () => {
    it('com a senha certa recebe USER_DEACTIVATED e não abre sessão', async () => {
      users.findByEmail.mockResolvedValue(
        makeUser({ status: UserStatus.DEACTIVATED }),
      );

      const error = await useCase.execute(credentials).catch((e) => e);

      expect(error).toBeInstanceOf(UserDeactivatedError);
      expect(error).toMatchObject({ code: 'USER_DEACTIVATED' });
      expect(refreshTokens.create).not.toHaveBeenCalled();
      expect(tokens.issueAccessToken).not.toHaveBeenCalled();
    });

    it('com a senha errada não revela a desativação (INVALID_CREDENTIALS)', async () => {
      const user = makeUser({ status: UserStatus.DEACTIVATED });
      users.findByEmail.mockResolvedValue(user);
      mockLoginState(user);

      await expect(
        useCase.execute({ ...credentials, password: 'errada-000000' }),
      ).rejects.toBeInstanceOf(InvalidCredentialsError);
    });
  });

  it('nunca registra senha, hash, token nem e-mail em log', async () => {
    const user = makeUser();
    users.findByEmail.mockResolvedValue(user);
    mockLoginState(user);

    await useCase.execute(credentials);
    await useCase
      .execute({ ...credentials, password: 'errada-000000' })
      .catch(() => undefined);
    users.findByEmail.mockResolvedValue(null);
    await useCase.execute(credentials).catch(() => undefined);

    const logs = logger.allCalls();
    for (const secret of [
      'senha-correta-123',
      'errada-000000',
      'hashed:',
      'access-for-',
      'refresh-1',
      'maria@pauta.local',
    ]) {
      expect(logs).not.toContain(secret);
    }
  });
});
