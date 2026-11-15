import type { Provider } from '@nestjs/common';

import {
  OWNER_REPOSITORY,
  type OwnerRepositoryInterface,
} from '@/modules/owner/application/interfaces/repositories/owner.repository.interface';
import {
  OWNER_QUERY_REPOSITORY,
  type OwnerQueryRepositoryInterface,
} from '@/modules/owner/application/interfaces/repositories/owner-query.repository.interface';
import { ArchiveOwnerUseCase } from '@/modules/owner/application/use-cases/archive-owner/archive-owner.use-case';
import {
  ARCHIVE_OWNER_USE_CASE,
  type ArchiveOwnerUseCaseInterface,
} from '@/modules/owner/application/use-cases/archive-owner/archive-owner.use-case.interface';
import {
  CLOCK,
  type ClockInterface,
} from '@/shared/application/interfaces/clock.interface';
import {
  LOGGER_SERVICE,
  type LoggerServiceInterface,
} from '@/shared/application/interfaces/logger.service.interface';

export const ArchiveOwnerProvider: Provider = {
  provide: ARCHIVE_OWNER_USE_CASE,
  inject: [OWNER_REPOSITORY, OWNER_QUERY_REPOSITORY, CLOCK, LOGGER_SERVICE],
  useFactory: (
    repository: OwnerRepositoryInterface,
    queryRepository: OwnerQueryRepositoryInterface,
    clock: ClockInterface,
    logger: LoggerServiceInterface,
  ): ArchiveOwnerUseCaseInterface =>
    new ArchiveOwnerUseCase(repository, queryRepository, clock, logger),
};
