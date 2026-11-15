import type { Provider } from '@nestjs/common';

import {
  PASSWORD_GENERATOR,
  type PasswordGeneratorInterface,
} from '@/modules/user/application/interfaces/password-generator.interface';
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
import { ResetUserPasswordUseCase } from '@/modules/user/application/use-cases/reset-user-password/reset-user-password.use-case';
import {
  RESET_USER_PASSWORD_USE_CASE,
  type ResetUserPasswordUseCaseInterface,
} from '@/modules/user/application/use-cases/reset-user-password/reset-user-password.use-case.interface';
import {
  CLOCK,
  type ClockInterface,
} from '@/shared/application/interfaces/clock.interface';
import {
  LOGGER_SERVICE,
  type LoggerServiceInterface,
} from '@/shared/application/interfaces/logger.service.interface';
import {
  PASSWORD_HASHER,
  type PasswordHasherInterface,
} from '@/shared/application/interfaces/password-hasher.interface';

export const ResetUserPasswordProvider: Provider = {
  provide: RESET_USER_PASSWORD_USE_CASE,
  inject: [
    USER_REPOSITORY,
    USER_QUERY_REPOSITORY,
    REFRESH_TOKEN_REPOSITORY,
    PASSWORD_HASHER,
    PASSWORD_GENERATOR,
    CLOCK,
    LOGGER_SERVICE,
  ],
  useFactory: (
    repository: UserRepositoryInterface,
    queryRepository: UserQueryRepositoryInterface,
    refreshTokens: RefreshTokenRepositoryInterface,
    hasher: PasswordHasherInterface,
    passwordGenerator: PasswordGeneratorInterface,
    clock: ClockInterface,
    logger: LoggerServiceInterface,
  ): ResetUserPasswordUseCaseInterface =>
    new ResetUserPasswordUseCase(
      repository,
      queryRepository,
      refreshTokens,
      hasher,
      passwordGenerator,
      clock,
      logger,
    ),
};
