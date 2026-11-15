import type { Provider } from '@nestjs/common';

import {
  USER_REPOSITORY,
  type UserRepositoryInterface,
} from '@/modules/user/application/interfaces/repositories/user.repository.interface';
import {
  USER_QUERY_REPOSITORY,
  type UserQueryRepositoryInterface,
} from '@/modules/user/application/interfaces/repositories/user-query.repository.interface';
import { ReactivateUserUseCase } from '@/modules/user/application/use-cases/reactivate-user/reactivate-user.use-case';
import {
  REACTIVATE_USER_USE_CASE,
  type ReactivateUserUseCaseInterface,
} from '@/modules/user/application/use-cases/reactivate-user/reactivate-user.use-case.interface';
import {
  CLOCK,
  type ClockInterface,
} from '@/shared/application/interfaces/clock.interface';
import {
  LOGGER_SERVICE,
  type LoggerServiceInterface,
} from '@/shared/application/interfaces/logger.service.interface';

export const ReactivateUserProvider: Provider = {
  provide: REACTIVATE_USER_USE_CASE,
  inject: [USER_REPOSITORY, USER_QUERY_REPOSITORY, CLOCK, LOGGER_SERVICE],
  useFactory: (
    repository: UserRepositoryInterface,
    queryRepository: UserQueryRepositoryInterface,
    clock: ClockInterface,
    logger: LoggerServiceInterface,
  ): ReactivateUserUseCaseInterface =>
    new ReactivateUserUseCase(repository, queryRepository, clock, logger),
};
