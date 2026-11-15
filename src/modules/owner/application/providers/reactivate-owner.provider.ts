import type { Provider } from '@nestjs/common';

import {
  OWNER_REPOSITORY,
  type OwnerRepositoryInterface,
} from '@/modules/owner/application/interfaces/repositories/owner.repository.interface';
import {
  OWNER_QUERY_REPOSITORY,
  type OwnerQueryRepositoryInterface,
} from '@/modules/owner/application/interfaces/repositories/owner-query.repository.interface';
import { ReactivateOwnerUseCase } from '@/modules/owner/application/use-cases/reactivate-owner/reactivate-owner.use-case';
import {
  REACTIVATE_OWNER_USE_CASE,
  type ReactivateOwnerUseCaseInterface,
} from '@/modules/owner/application/use-cases/reactivate-owner/reactivate-owner.use-case.interface';
import {
  CLOCK,
  type ClockInterface,
} from '@/shared/application/interfaces/clock.interface';
import {
  LOGGER_SERVICE,
  type LoggerServiceInterface,
} from '@/shared/application/interfaces/logger.service.interface';

export const ReactivateOwnerProvider: Provider = {
  provide: REACTIVATE_OWNER_USE_CASE,
  inject: [OWNER_REPOSITORY, OWNER_QUERY_REPOSITORY, CLOCK, LOGGER_SERVICE],
  useFactory: (
    repository: OwnerRepositoryInterface,
    queryRepository: OwnerQueryRepositoryInterface,
    clock: ClockInterface,
    logger: LoggerServiceInterface,
  ): ReactivateOwnerUseCaseInterface =>
    new ReactivateOwnerUseCase(repository, queryRepository, clock, logger),
};
