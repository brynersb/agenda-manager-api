import type { Provider } from '@nestjs/common';

import {
  PASSWORD_GENERATOR,
  type PasswordGeneratorInterface,
} from '@/modules/user/application/interfaces/password-generator.interface';
import {
  USER_REPOSITORY,
  type UserRepositoryInterface,
} from '@/modules/user/application/interfaces/repositories/user.repository.interface';
import {
  USER_QUERY_REPOSITORY,
  type UserQueryRepositoryInterface,
} from '@/modules/user/application/interfaces/repositories/user-query.repository.interface';
import { CreateUserUseCase } from '@/modules/user/application/use-cases/create-user/create-user.use-case';
import {
  CREATE_USER_USE_CASE,
  type CreateUserUseCaseInterface,
} from '@/modules/user/application/use-cases/create-user/create-user.use-case.interface';
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

export const CreateUserProvider: Provider = {
  provide: CREATE_USER_USE_CASE,
  inject: [
    USER_REPOSITORY,
    USER_QUERY_REPOSITORY,
    PASSWORD_HASHER,
    PASSWORD_GENERATOR,
    CLOCK,
    LOGGER_SERVICE,
  ],
  useFactory: (
    repository: UserRepositoryInterface,
    queryRepository: UserQueryRepositoryInterface,
    hasher: PasswordHasherInterface,
    passwordGenerator: PasswordGeneratorInterface,
    clock: ClockInterface,
    logger: LoggerServiceInterface,
  ): CreateUserUseCaseInterface =>
    new CreateUserUseCase(
      repository,
      queryRepository,
      hasher,
      passwordGenerator,
      clock,
      logger,
    ),
};
