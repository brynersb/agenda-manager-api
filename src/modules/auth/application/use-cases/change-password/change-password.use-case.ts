import {
  InvalidCurrentPasswordError,
  UnauthenticatedError,
  UserDeactivatedError,
} from '@/modules/auth/domain/errors/auth.errors';
import type { RefreshTokenRepositoryInterface } from '@/modules/user/application/interfaces/repositories/refresh-token.repository.interface';
import type { UserRepositoryInterface } from '@/modules/user/application/interfaces/repositories/user.repository.interface';
import { WeakPasswordError } from '@/modules/user/domain/errors/user.errors';
import { assertPasswordPolicy } from '@/modules/user/domain/services/password-policy';
import type { ClockInterface } from '@/shared/application/interfaces/clock.interface';
import type { LoggerServiceInterface } from '@/shared/application/interfaces/logger.service.interface';
import type { PasswordHasherInterface } from '@/shared/application/interfaces/password-hasher.interface';
import type {
  ChangePasswordInput,
  ChangePasswordUseCaseInterface,
} from './change-password.use-case.interface';

/**
 * Troca a senha do próprio usuário. Exige a senha atual, aplica a política e
 * proíbe repetir a senha atual. Limpa `mustChangePassword` e **revoga todos os
 * refresh tokens** do usuário (inclusive o desta sessão: o cliente entra de
 * novo com a senha nova).
 */
export class ChangePasswordUseCase implements ChangePasswordUseCaseInterface {
  constructor(
    private readonly users: UserRepositoryInterface,
    private readonly refreshTokens: RefreshTokenRepositoryInterface,
    private readonly hasher: PasswordHasherInterface,
    private readonly clock: ClockInterface,
    private readonly logger: LoggerServiceInterface,
  ) {
    this.logger.setLogPrefix(ChangePasswordUseCase.name);
  }

  async execute(input: ChangePasswordInput): Promise<void> {
    const user = await this.users.findById(input.userId);
    if (!user) {
      throw new UnauthenticatedError();
    }
    if (!user.isActive) {
      throw new UserDeactivatedError();
    }

    if (!(await this.hasher.verify(input.currentPassword, user.passwordHash))) {
      this.logger.warn('Troca de senha recusada: senha atual não confere', {
        'evt.name': 'auth.password_changed',
        outcome: 'failure',
        reason: 'invalid_current_password',
        user_id: user.id,
        tags: ['auth', 'security'],
      });
      throw new InvalidCurrentPasswordError();
    }

    assertPasswordPolicy(input.newPassword);
    if (input.newPassword === input.currentPassword) {
      throw new WeakPasswordError('A nova senha deve ser diferente da atual.');
    }

    const now = this.clock.now();
    user.changePassword(
      await this.hasher.hash(input.newPassword),
      { id: user.id, name: user.name.value },
      now,
    );
    await this.users.save(user, user.version);
    await this.refreshTokens.revokeAllByUserId(user.id, now);

    this.logger.info('Senha alterada pelo próprio usuário', {
      'evt.name': 'auth.password_changed',
      outcome: 'success',
      user_id: user.id,
      tags: ['auth', 'security'],
    });
  }
}
