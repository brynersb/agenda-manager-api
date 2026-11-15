import type { Provider } from '@nestjs/common';

import {
  USER_REPOSITORY,
  type UserRepositoryInterface,
} from '@/modules/user/application/interfaces/repositories/user.repository.interface';
import { BootstrapAdminUseCase } from '@/modules/user/application/use-cases/bootstrap-admin/bootstrap-admin.use-case';
import {
  BOOTSTRAP_ADMIN_USE_CASE,
  type BootstrapAdminUseCaseInterface,
} from '@/modules/user/application/use-cases/bootstrap-admin/bootstrap-admin.use-case.interface';
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

export const BootstrapAdminProvider: Provider = {
  provide: BOOTSTRAP_ADMIN_USE_CASE,
  inject: [USER_REPOSITORY, PASSWORD_HASHER, CLOCK, LOGGER_SERVICE],
  useFactory: (
    repository: UserRepositoryInterface,
    hasher: PasswordHasherInterface,
    clock: ClockInterface,
    logger: LoggerServiceInterface,
  ): BootstrapAdminUseCaseInterface =>
    new BootstrapAdminUseCase(repository, hasher, clock, logger),
};
