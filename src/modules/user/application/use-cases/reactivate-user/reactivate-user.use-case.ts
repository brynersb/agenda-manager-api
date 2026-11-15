import type { UserRepositoryInterface } from '@/modules/user/application/interfaces/repositories/user.repository.interface';
import type {
  UserQueryRepositoryInterface,
  UserReadModel,
} from '@/modules/user/application/interfaces/repositories/user-query.repository.interface';
import { UserNotFoundError } from '@/modules/user/domain/errors/user.errors';
import type { ClockInterface } from '@/shared/application/interfaces/clock.interface';
import type { LoggerServiceInterface } from '@/shared/application/interfaces/logger.service.interface';
import type {
  ReactivateUserInput,
  ReactivateUserUseCaseInterface,
} from './reactivate-user.use-case.interface';

/** Reativa o usuário (e destrava a conta). Idempotente. */
export class ReactivateUserUseCase implements ReactivateUserUseCaseInterface {
  constructor(
    private readonly repository: UserRepositoryInterface,
    private readonly queryRepository: UserQueryRepositoryInterface,
    private readonly clock: ClockInterface,
    private readonly logger: LoggerServiceInterface,
  ) {
    this.logger.setLogPrefix(ReactivateUserUseCase.name);
  }

  async execute(input: ReactivateUserInput): Promise<UserReadModel> {
    const user = await this.repository.findById(input.id);
    if (!user) {
      throw new UserNotFoundError();
    }

    if (!user.isActive) {
      user.reactivate(input.actor, this.clock.now());
      await this.repository.save(user, user.version);

      this.logger.info('Usuário reativado', {
        'evt.name': 'user.reactivated',
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
