import type { Provider } from '@nestjs/common';

import {
  REFRESH_TOKEN_REPOSITORY,
  type RefreshTokenRepositoryInterface,
} from '@/modules/user/application/interfaces/repositories/refresh-token.repository.interface';
import {
  USER_REPOSITORY,
  type UserRepositoryInterface,
} from '@/modules/user/application/interfaces/repositories/user.repository.interface';
import {
  USER_QUERY_REPOSITORY,
  type UserQueryRepositoryInterface,
} from '@/modules/user/application/interfaces/repositories/user-query.repository.interface';
import { DeactivateUserUseCase } from '@/modules/user/application/use-cases/deactivate-user/deactivate-user.use-case';
import {
  DEACTIVATE_USER_USE_CASE,
  type DeactivateUserUseCaseInterface,
} from '@/modules/user/application/use-cases/deactivate-user/deactivate-user.use-case.interface';
import {
  CLOCK,
  type ClockInterface,
} from '@/shared/application/interfaces/clock.interface';
import {
  LOGGER_SERVICE,
  type LoggerServiceInterface,
} from '@/shared/application/interfaces/logger.service.interface';

export const DeactivateUserProvider: Provider = {
  provide: DEACTIVATE_USER_USE_CASE,
  inject: [
    USER_REPOSITORY,
    USER_QUERY_REPOSITORY,
    REFRESH_TOKEN_REPOSITORY,
    CLOCK,
    LOGGER_SERVICE,
  ],
  useFactory: (
    repository: UserRepositoryInterface,
    queryRepository: UserQueryRepositoryInterface,
    refreshTokens: RefreshTokenRepositoryInterface,
    clock: ClockInterface,
    logger: LoggerServiceInterface,
  ): DeactivateUserUseCaseInterface =>
    new DeactivateUserUseCase(
      repository,
      queryRepository,
      refreshTokens,
      clock,
      logger,
    ),
};
