import type { Provider } from '@nestjs/common';

import {
  ESTATE_DEVELOPMENT_REPOSITORY,
  type EstateDevelopmentRepositoryInterface,
} from '@/modules/estate-development/application/interfaces/repositories/estate-development.repository.interface';
import {
  ESTATE_DEVELOPMENT_QUERY_REPOSITORY,
  type EstateDevelopmentQueryRepositoryInterface,
} from '@/modules/estate-development/application/interfaces/repositories/estate-development-query.repository.interface';
import { ReactivateEstateDevelopmentUseCase } from '@/modules/estate-development/application/use-cases/reactivate-estate-development/reactivate-estate-development.use-case';
import {
  REACTIVATE_ESTATE_DEVELOPMENT_USE_CASE,
  type ReactivateEstateDevelopmentUseCaseInterface,
} from '@/modules/estate-development/application/use-cases/reactivate-estate-development/reactivate-estate-development.use-case.interface';
import {
  CLOCK,
  type ClockInterface,
} from '@/shared/application/interfaces/clock.interface';
import {
  LOGGER_SERVICE,
  type LoggerServiceInterface,
} from '@/shared/application/interfaces/logger.service.interface';

export const ReactivateEstateDevelopmentProvider: Provider = {
  provide: REACTIVATE_ESTATE_DEVELOPMENT_USE_CASE,
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
  ): ReactivateEstateDevelopmentUseCaseInterface =>
    new ReactivateEstateDevelopmentUseCase(
      repository,
      queryRepository,
      clock,
      logger,
    ),
};
