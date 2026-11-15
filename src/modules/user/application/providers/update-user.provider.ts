import type { Provider } from '@nestjs/common';

import {
  USER_REPOSITORY,
  type UserRepositoryInterface,
} from '@/modules/user/application/interfaces/repositories/user.repository.interface';
import {
  USER_QUERY_REPOSITORY,
  type UserQueryRepositoryInterface,
} from '@/modules/user/application/interfaces/repositories/user-query.repository.interface';
import { UpdateUserUseCase } from '@/modules/user/application/use-cases/update-user/update-user.use-case';
import {
  UPDATE_USER_USE_CASE,
  type UpdateUserUseCaseInterface,
} from '@/modules/user/application/use-cases/update-user/update-user.use-case.interface';
import {
  CLOCK,
  type ClockInterface,
} from '@/shared/application/interfaces/clock.interface';
import {
  LOGGER_SERVICE,
  type LoggerServiceInterface,
} from '@/shared/application/interfaces/logger.service.interface';

export const UpdateUserProvider: Provider = {
  provide: UPDATE_USER_USE_CASE,
  inject: [USER_REPOSITORY, USER_QUERY_REPOSITORY, CLOCK, LOGGER_SERVICE],
  useFactory: (
    repository: UserRepositoryInterface,
    queryRepository: UserQueryRepositoryInterface,
    clock: ClockInterface,
    logger: LoggerServiceInterface,
  ): UpdateUserUseCaseInterface =>
    new UpdateUserUseCase(repository, queryRepository, clock, logger),
};
