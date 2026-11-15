import type { AuthSession } from '@/modules/auth/application/types/auth-session';
import type { SessionIssuer } from '@/modules/auth/application/use-cases/common/session-issuer';
import {
  AccountLockedError,
  InvalidCredentialsError,
  UserDeactivatedError,
} from '@/modules/auth/domain/errors/auth.errors';
import type { UserRepositoryInterface } from '@/modules/user/application/interfaces/repositories/user.repository.interface';
import type { LoginLockPolicy } from '@/modules/user/domain/entities/user.domain-entity';
import { UserEmail } from '@/modules/user/domain/value-objects/user-email';
import type { ClockInterface } from '@/shared/application/interfaces/clock.interface';
import type { LoggerServiceInterface } from '@/shared/application/interfaces/logger.service.interface';
import type { PasswordHasherInterface } from '@/shared/application/interfaces/password-hasher.interface';
import type {
  LoginInput,
  LoginUseCaseInterface,
} from './login.use-case.interface';

/**
 * Login por e-mail e senha (ADR-016).
 *
 * - E-mail inexistente e senha errada dão a mesma resposta
 *   (`INVALID_CREDENTIALS`) e gastam o mesmo tempo: sem usuário, a senha é
 *   conferida contra um hash descartável.
 * - Conta bloqueada responde `ACCOUNT_LOCKED` sem nem conferir a senha: isso
 *   revela que o e-mail existe, o que só ocorre depois de várias falhas e é
 *   contido pelo limite de requisições por IP.
 * - Usuário desativado só descobre depois de provar a senha.
 * - A contagem de falhas e o bloqueio são atômicos (`updateLoginState`).
 */
export class LoginUseCase implements LoginUseCaseInterface {
  constructor(
    private readonly users: UserRepositoryInterface,
    private readonly hasher: PasswordHasherInterface,
    private readonly sessions: SessionIssuer,
    private readonly clock: ClockInterface,
    private readonly lockPolicy: LoginLockPolicy,
    private readonly logger: LoggerServiceInterface,
  ) {
    this.logger.setLogPrefix(LoginUseCase.name);
  }

  async execute(input: LoginInput): Promise<AuthSession> {
    const user = await this.users.findByEmail(UserEmail.normalize(input.email));

    if (!user) {
      await this.hasher.burnVerification(input.password);
      this.recordFailure('invalid_credentials');
      throw new InvalidCredentialsError();
    }

    const now = this.clock.now();
    if (user.isLockedAt(now)) {
      this.recordBlocked('account_locked', user.id);
      throw new AccountLockedError(user.lockMinutesRemaining(now));
    }

    if (!(await this.hasher.verify(input.password, user.passwordHash))) {
      const updated = await this.users.updateLoginState(user.id, (u) =>
        u.registerFailedLogin(now, this.lockPolicy),
      );
      if (updated?.isLockedAt(now)) {
        this.logger.warn('Conta bloqueada por excesso de tentativas de login', {
          'evt.name': 'auth.account_locked',
          outcome: 'blocked',
          user_id: user.id,
          lock_minutes: this.lockPolicy.lockMinutes,
          tags: ['auth', 'security'],
        });
      }
      this.recordFailure('invalid_credentials', user.id);
      throw new InvalidCredentialsError();
    }

    if (!user.isActive) {
      this.recordBlocked('user_deactivated', user.id);
      throw new UserDeactivatedError();
    }

    await this.users.updateLoginState(user.id, (u) =>
      u.registerSuccessfulLogin(now),
    );
    const session = await this.sessions.open(user, {
      userAgent: input.userAgent,
      ip: input.ip,
    });

    this.logger.info('Login realizado', {
      'evt.name': 'auth.login',
      outcome: 'success',
      user_id: user.id,
      tags: ['auth'],
    });
    return session;
  }

  private recordFailure(reason: string, userId?: string): void {
    this.logger.warn('Login recusado', {
      'evt.name': 'auth.login',
      outcome: 'failure',
      reason,
      user_id: userId,
      tags: ['auth', 'security'],
    });
  }

  private recordBlocked(reason: string, userId: string): void {
    this.logger.warn('Login bloqueado', {
      'evt.name': 'auth.login',
      outcome: 'blocked',
      reason,
      user_id: userId,
      tags: ['auth', 'security'],
    });
  }
}
