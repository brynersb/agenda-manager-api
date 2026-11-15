import type { Provider } from '@nestjs/common';

import {
  CONTENT_BRIEF_REPOSITORY,
  type ContentBriefRepositoryInterface,
} from '@/modules/content-brief/application/interfaces/repositories/content-brief.repository.interface';
import {
  REGISTRY_QUERY_REPOSITORY,
  type RegistryQueryRepositoryInterface,
} from '@/modules/content-brief/application/interfaces/repositories/registry-query.repository.interface';
import {
  FIND_CONTENT_BRIEF_BY_ID_QUERY,
  type FindContentBriefByIdQueryInterface,
} from '@/modules/content-brief/application/queries/find-content-brief-by-id/find-content-brief-by-id.query.interface';
import { CreateContentBriefUseCase } from '@/modules/content-brief/application/use-cases/create-content-brief/create-content-brief.use-case';
import {
  CREATE_CONTENT_BRIEF_USE_CASE,
  type CreateContentBriefUseCaseInterface,
} from '@/modules/content-brief/application/use-cases/create-content-brief/create-content-brief.use-case.interface';
import {
  CLOCK,
  type ClockInterface,
} from '@/shared/application/interfaces/clock.interface';
import {
  LOGGER_SERVICE,
  type LoggerServiceInterface,
} from '@/shared/application/interfaces/logger.service.interface';

export const CreateContentBriefProvider: Provider = {
  provide: CREATE_CONTENT_BRIEF_USE_CASE,
  inject: [
    CONTENT_BRIEF_REPOSITORY,
    REGISTRY_QUERY_REPOSITORY,
    FIND_CONTENT_BRIEF_BY_ID_QUERY,
    CLOCK,
    LOGGER_SERVICE,
  ],
  useFactory: (
    repository: ContentBriefRepositoryInterface,
    registryQueryRepository: RegistryQueryRepositoryInterface,
    findContentBriefById: FindContentBriefByIdQueryInterface,
    clock: ClockInterface,
    logger: LoggerServiceInterface,
  ): CreateContentBriefUseCaseInterface =>
    new CreateContentBriefUseCase(
      repository,
      registryQueryRepository,
      findContentBriefById,
      clock,
      logger,
    ),
};
