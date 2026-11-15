import type { RefreshTokenRepositoryInterface } from '@/modules/user/application/interfaces/repositories/refresh-token.repository.interface';
import type { UserRepositoryInterface } from '@/modules/user/application/interfaces/repositories/user.repository.interface';
import type {
  UserQueryRepositoryInterface,
  UserReadModel,
} from '@/modules/user/application/interfaces/repositories/user-query.repository.interface';
import { UserNotFoundError } from '@/modules/user/domain/errors/user.errors';
import {
  assertNotLastActiveAdmin,
  assertNotSelf,
} from '@/modules/user/domain/services/user-admin-rules';
import type { ClockInterface } from '@/shared/application/interfaces/clock.interface';
import type { LoggerServiceInterface } from '@/shared/application/interfaces/logger.service.interface';
import type {
  DeactivateUserInput,
  DeactivateUserUseCaseInterface,
} from './deactivate-user.use-case.interface';

/**
 * Desativa o usuário e revoga as sessões dele. Idempotente. O access token já
 * emitido continua valendo até expirar (no máximo `JWT_ACCESS_TTL`): o guard
 * não consulta o banco por requisição.
 */
export class DeactivateUserUseCase implements DeactivateUserUseCaseInterface {
  constructor(
    private readonly repository: UserRepositoryInterface,
    private readonly queryRepository: UserQueryRepositoryInterface,
    private readonly refreshTokens: RefreshTokenRepositoryInterface,
    private readonly clock: ClockInterface,
    private readonly logger: LoggerServiceInterface,
  ) {
    this.logger.setLogPrefix(DeactivateUserUseCase.name);
  }

  async execute(input: DeactivateUserInput): Promise<UserReadModel> {
    const user = await this.repository.findById(input.id);
    if (!user) {
      throw new UserNotFoundError();
    }
    assertNotSelf(input.actor.id, user);

    if (user.isActive) {
      assertNotLastActiveAdmin(
        user,
        await this.repository.countActiveAdminsExcluding(user.id),
      );
      const now = this.clock.now();
      user.deactivate(input.actor, now);
      await this.repository.save(user, user.version);
      await this.refreshTokens.revokeAllByUserId(user.id, now);

      this.logger.info('Usuário desativado', {
        'evt.name': 'user.deactivated',
        outcome: 'success',
        user_id: user.id,
        user_sub: input.actor.id,
        tags: ['user', 'admin'],
      });
    }

    const current = await this.queryRepository.findOneById(user.id);
    if (!current) {
      throw new UserNotFoundError();
    }
    return current;
  }
}
