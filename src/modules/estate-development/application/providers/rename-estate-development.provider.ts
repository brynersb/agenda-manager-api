import type { Provider } from '@nestjs/common';

import {
  ESTATE_DEVELOPMENT_REPOSITORY,
  type EstateDevelopmentRepositoryInterface,
} from '@/modules/estate-development/application/interfaces/repositories/estate-development.repository.interface';
import {
  ESTATE_DEVELOPMENT_QUERY_REPOSITORY,
  type EstateDevelopmentQueryRepositoryInterface,
} from '@/modules/estate-development/application/interfaces/repositories/estate-development-query.repository.interface';
import { RenameEstateDevelopmentUseCase } from '@/modules/estate-development/application/use-cases/rename-estate-development/rename-estate-development.use-case';
import {
  RENAME_ESTATE_DEVELOPMENT_USE_CASE,
  type RenameEstateDevelopmentUseCaseInterface,
} from '@/modules/estate-development/application/use-cases/rename-estate-development/rename-estate-development.use-case.interface';
import {
  CLOCK,
  type ClockInterface,
} from '@/shared/application/interfaces/clock.interface';
import {
  LOGGER_SERVICE,
  type LoggerServiceInterface,
} from '@/shared/application/interfaces/logger.service.interface';

export const RenameEstateDevelopmentProvider: Provider = {
  provide: RENAME_ESTATE_DEVELOPMENT_USE_CASE,
  inject: [
    ESTATE_DEVELOPMENT_REPOSITORY,
    ESTATE_DEVELOPMENT_QUERY_REPOSITORY,
    CLOCK,
    LOGGER_SERVICE,
  ],
  useFactory: (
    repository: EstateDevelopmentRepositoryInterface,
    queryRepository: EstateDevelopmentQueryRepositoryInterface,
    clock: ClockInterface,
    logger: LoggerServiceInterface,
  ): RenameEstateDevelopmentUseCaseInterface =>
    new RenameEstateDevelopmentUseCase(
      repository,
      queryRepository,
      clock,
      logger,
    ),
};
