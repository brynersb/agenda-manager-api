import type { Provider } from '@nestjs/common';

import {
  OWNER_REPOSITORY,
  type OwnerRepositoryInterface,
} from '@/modules/owner/application/interfaces/repositories/owner.repository.interface';
import {
  OWNER_QUERY_REPOSITORY,
  type OwnerQueryRepositoryInterface,
} from '@/modules/owner/application/interfaces/repositories/owner-query.repository.interface';
import { CreateOwnerUseCase } from '@/modules/owner/application/use-cases/create-owner/create-owner.use-case';
import {
  CREATE_OWNER_USE_CASE,
  type CreateOwnerUseCaseInterface,
} from '@/modules/owner/application/use-cases/create-owner/create-owner.use-case.interface';
import {
  CLOCK,
  type ClockInterface,
} from '@/shared/application/interfaces/clock.interface';
import {
  LOGGER_SERVICE,
  type LoggerServiceInterface,
} from '@/shared/application/interfaces/logger.service.interface';

export const CreateOwnerProvider: Provider = {
  provide: CREATE_OWNER_USE_CASE,
  inject: [OWNER_REPOSITORY, OWNER_QUERY_REPOSITORY, CLOCK, LOGGER_SERVICE],
  useFactory: (
    repository: OwnerRepositoryInterface,
    queryRepository: OwnerQueryRepositoryInterface,
    clock: ClockInterface,
    logger: LoggerServiceInterface,
  ): CreateOwnerUseCaseInterface =>
    new CreateOwnerUseCase(repository, queryRepository, clock, logger),
};
