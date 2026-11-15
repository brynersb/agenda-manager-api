import type { Provider } from '@nestjs/common';

import {
  CONTENT_BRIEF_REPOSITORY,
  type ContentBriefRepositoryInterface,
} from '@/modules/content-brief/application/interfaces/repositories/content-brief.repository.interface';
import { DeleteContentBriefUseCase } from '@/modules/content-brief/application/use-cases/delete-content-brief/delete-content-brief.use-case';
import {
  DELETE_CONTENT_BRIEF_USE_CASE,
  type DeleteContentBriefUseCaseInterface,
} from '@/modules/content-brief/application/use-cases/delete-content-brief/delete-content-brief.use-case.interface';
import {
  CLOCK,
  type ClockInterface,
} from '@/shared/application/interfaces/clock.interface';
import {
  LOGGER_SERVICE,
  type LoggerServiceInterface,
} from '@/shared/application/interfaces/logger.service.interface';

export const DeleteContentBriefProvider: Provider = {
  provide: DELETE_CONTENT_BRIEF_USE_CASE,
  inject: [CONTENT_BRIEF_REPOSITORY, CLOCK, LOGGER_SERVICE],
  useFactory: (
    repository: ContentBriefRepositoryInterface,
    clock: ClockInterface,
    logger: LoggerServiceInterface,
  ): DeleteContentBriefUseCaseInterface =>
    new DeleteContentBriefUseCase(repository, clock, logger),
};
