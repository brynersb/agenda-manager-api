import type { UserRepositoryInterface } from '@/modules/user/application/interfaces/repositories/user.repository.interface';
import type {
  UserQueryRepositoryInterface,
  UserReadModel,
} from '@/modules/user/application/interfaces/repositories/user-query.repository.interface';
import {
  UserNotFoundError,
  UserVersionOutdatedError,
} from '@/modules/user/domain/errors/user.errors';
import {
  assertNotLastActiveAdmin,
  assertNotSelf,
} from '@/modules/user/domain/services/user-admin-rules';
import { UserName } from '@/modules/user/domain/value-objects/user-name';
import type { ClockInterface } from '@/shared/application/interfaces/clock.interface';
import type { LoggerServiceInterface } from '@/shared/application/interfaces/logger.service.interface';
import { ValidationError } from '@/shared/domain/errors/domain-error';
import type {
  UpdateUserInput,
  UpdateUserUseCaseInterface,
} from './update-user.use-case.interface';

export class UpdateUserUseCase implements UpdateUserUseCaseInterface {
  constructor(
    private readonly repository: UserRepositoryInterface,
    private readonly queryRepository: UserQueryRepositoryInterface,
    private readonly clock: ClockInterface,
    private readonly logger: LoggerServiceInterface,
  ) {
    this.logger.setLogPrefix(UpdateUserUseCase.name);
  }

  async execute(input: UpdateUserInput): Promise<UserReadModel> {
    if (input.name === undefined && input.role === undefined) {
      throw new ValidationError(
        'INVALID_REQUEST',
        'Informe ao menos um campo para alterar (name ou role)',
      );
    }
    const name =
      input.name === undefined ? undefined : UserName.create(input.name);

    const user = await this.repository.findById(input.id);
    if (!user) {
      throw new UserNotFoundError();
    }
    if (user.version !== input.version) {
      throw new UserVersionOutdatedError();
    }

    const now = this.clock.now();
    const changesRole = input.role !== undefined && input.role !== user.role;
    if (changesRole) {
      // Rebaixar a si mesmo é proibido; mudar o papel do último admin também.
      assertNotSelf(input.actor.id, user);
      assertNotLastActiveAdmin(
        user,
        await this.repository.countActiveAdminsExcluding(user.id),
      );
    }

    if (name !== undefined) {
      user.rename(name, input.actor, now);
    }
    if (changesRole && input.role !== undefined) {
      user.changeRole(input.role, input.actor, now);
    }
    await this.repository.save(user, input.version);

    this.logger.info('Usuário atualizado', {
      'evt.name': 'user.updated',
      outcome: 'success',
      user_id: user.id,
      role_changed: changesRole,
      user_sub: input.actor.id,
      tags: ['user', 'admin'],
    });

    const updated = await this.queryRepository.findOneById(user.id);
    if (!updated) {
      throw new UserNotFoundError();
    }
    return updated;
  }
}
