import type { Provider } from '@nestjs/common';

import {
  ESTATE_DEVELOPMENT_REPOSITORY,
  type EstateDevelopmentRepositoryInterface,
} from '@/modules/estate-development/application/interfaces/repositories/estate-development.repository.interface';
import {
  ESTATE_DEVELOPMENT_QUERY_REPOSITORY,
  type EstateDevelopmentQueryRepositoryInterface,
} from '@/modules/estate-development/application/interfaces/repositories/estate-development-query.repository.interface';
import { CreateEstateDevelopmentUseCase } from '@/modules/estate-development/application/use-cases/create-estate-development/create-estate-development.use-case';
import {
  CREATE_ESTATE_DEVELOPMENT_USE_CASE,
  type CreateEstateDevelopmentUseCaseInterface,
} from '@/modules/estate-development/application/use-cases/create-estate-development/create-estate-development.use-case.interface';
import {
  CLOCK,
  type ClockInterface,
} from '@/shared/application/interfaces/clock.interface';
import {
  LOGGER_SERVICE,
  type LoggerServiceInterface,
} from '@/shared/application/interfaces/logger.service.interface';

export const CreateEstateDevelopmentProvider: Provider = {
  provide: CREATE_ESTATE_DEVELOPMENT_USE_CASE,
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
  ): CreateEstateDevelopmentUseCaseInterface =>
    new CreateEstateDevelopmentUseCase(
      repository,
      queryRepository,
      clock,
      logger,
    ),
};
