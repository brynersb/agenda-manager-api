import type { PasswordGeneratorInterface } from '@/modules/user/application/interfaces/password-generator.interface';
import type { RefreshTokenRepositoryInterface } from '@/modules/user/application/interfaces/repositories/refresh-token.repository.interface';
import type { UserRepositoryInterface } from '@/modules/user/application/interfaces/repositories/user.repository.interface';
import type { UserQueryRepositoryInterface } from '@/modules/user/application/interfaces/repositories/user-query.repository.interface';
import { UserNotFoundError } from '@/modules/user/domain/errors/user.errors';
import type { ClockInterface } from '@/shared/application/interfaces/clock.interface';
import type { LoggerServiceInterface } from '@/shared/application/interfaces/logger.service.interface';
import type { PasswordHasherInterface } from '@/shared/application/interfaces/password-hasher.interface';
import type {
  ResetUserPasswordInput,
  ResetUserPasswordResult,
  ResetUserPasswordUseCaseInterface,
} from './reset-user-password.use-case.interface';

/**
 * Redefine a senha por uma provisória gerada (devolvida uma única vez), exige a
 * troca no próximo login, destrava a conta e revoga todas as sessões.
 */
export class ResetUserPasswordUseCase
  implements ResetUserPasswordUseCaseInterface
{
  constructor(
    private readonly repository: UserRepositoryInterface,
    private readonly queryRepository: UserQueryRepositoryInterface,
    private readonly refreshTokens: RefreshTokenRepositoryInterface,
    private readonly hasher: PasswordHasherInterface,
    private readonly passwordGenerator: PasswordGeneratorInterface,
    private readonly clock: ClockInterface,
    private readonly logger: LoggerServiceInterface,
  ) {
    this.logger.setLogPrefix(ResetUserPasswordUseCase.name);
  }

  async execute(
    input: ResetUserPasswordInput,
  ): Promise<ResetUserPasswordResult> {
    const user = await this.repository.findById(input.id);
    if (!user) {
      throw new UserNotFoundError();
    }

    const temporaryPassword = this.passwordGenerator.generate();
    const now = this.clock.now();
    user.resetPassword(
      await this.hasher.hash(temporaryPassword),
      input.actor,
      now,
    );
    await this.repository.save(user, user.version);
    await this.refreshTokens.revokeAllByUserId(user.id, now);

    this.logger.info('Senha de usuário redefinida', {
      'evt.name': 'user.password_reset',
      outcome: 'success',
      user_id: user.id,
      user_sub: input.actor.id,
      tags: ['user', 'admin', 'security'],
    });

    const current = await this.queryRepository.findOneById(user.id);
    if (!current) {
      throw new UserNotFoundError();
    }
    return { user: current, temporaryPassword };
  }
}
