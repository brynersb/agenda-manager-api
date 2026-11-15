import type { Provider } from '@nestjs/common';

import {
  OWNER_REPOSITORY,
  type OwnerRepositoryInterface,
} from '@/modules/owner/application/interfaces/repositories/owner.repository.interface';
import {
  OWNER_QUERY_REPOSITORY,
  type OwnerQueryRepositoryInterface,
} from '@/modules/owner/application/interfaces/repositories/owner-query.repository.interface';
import { RenameOwnerUseCase } from '@/modules/owner/application/use-cases/rename-owner/rename-owner.use-case';
import {
  RENAME_OWNER_USE_CASE,
  type RenameOwnerUseCaseInterface,
} from '@/modules/owner/application/use-cases/rename-owner/rename-owner.use-case.interface';
import {
  CLOCK,
  type ClockInterface,
} from '@/shared/application/interfaces/clock.interface';
import {
  LOGGER_SERVICE,
  type LoggerServiceInterface,
} from '@/shared/application/interfaces/logger.service.interface';

export const RenameOwnerProvider: Provider = {
  provide: RENAME_OWNER_USE_CASE,
  inject: [OWNER_REPOSITORY, OWNER_QUERY_REPOSITORY, CLOCK, LOGGER_SERVICE],
  useFactory: (
    repository: OwnerRepositoryInterface,
    queryRepository: OwnerQueryRepositoryInterface,
    clock: ClockInterface,
    logger: LoggerServiceInterface,
  ): RenameOwnerUseCaseInterface =>
    new RenameOwnerUseCase(repository, queryRepository, clock, logger),
};
