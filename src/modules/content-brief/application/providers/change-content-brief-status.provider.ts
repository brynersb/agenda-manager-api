import type { Provider } from '@nestjs/common';

import {
  CONTENT_BRIEF_REPOSITORY,
  type ContentBriefRepositoryInterface,
} from '@/modules/content-brief/application/interfaces/repositories/content-brief.repository.interface';
import {
  FIND_CONTENT_BRIEF_BY_ID_QUERY,
  type FindContentBriefByIdQueryInterface,
} from '@/modules/content-brief/application/queries/find-content-brief-by-id/find-content-brief-by-id.query.interface';
import { ChangeContentBriefStatusUseCase } from '@/modules/content-brief/application/use-cases/change-content-brief-status/change-content-brief-status.use-case';
import {
  CHANGE_CONTENT_BRIEF_STATUS_USE_CASE,
  type ChangeContentBriefStatusUseCaseInterface,
} from '@/modules/content-brief/application/use-cases/change-content-brief-status/change-content-brief-status.use-case.interface';
import {
  CLOCK,
  type ClockInterface,
} from '@/shared/application/interfaces/clock.interface';
import {
  LOGGER_SERVICE,
  type LoggerServiceInterface,
} from '@/shared/application/interfaces/logger.service.interface';

export const ChangeContentBriefStatusProvider: Provider = {
  provide: CHANGE_CONTENT_BRIEF_STATUS_USE_CASE,
  inject: [
    CONTENT_BRIEF_REPOSITORY,
    FIND_CONTENT_BRIEF_BY_ID_QUERY,
    CLOCK,
    LOGGER_SERVICE,
  ],
  useFactory: (
    repository: ContentBriefRepositoryInterface,
    findContentBriefById: FindContentBriefByIdQueryInterface,
    clock: ClockInterface,
    logger: LoggerServiceInterface,
  ): ChangeContentBriefStatusUseCaseInterface =>
    new ChangeContentBriefStatusUseCase(
      repository,
      findContentBriefById,
      clock,
      logger,
    ),
};
