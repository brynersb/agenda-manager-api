import type { Provider } from '@nestjs/common';

import {
  CONTENT_BRIEF_QUERY_REPOSITORY,
  type ContentBriefQueryRepositoryInterface,
} from '@/modules/content-brief/application/interfaces/repositories/content-brief-query.repository.interface';
import { FindContentBriefByIdQuery } from '@/modules/content-brief/application/queries/find-content-brief-by-id/find-content-brief-by-id.query';
import {
  FIND_CONTENT_BRIEF_BY_ID_QUERY,
  type FindContentBriefByIdQueryInterface,
} from '@/modules/content-brief/application/queries/find-content-brief-by-id/find-content-brief-by-id.query.interface';
import {
  CLOCK,
  type ClockInterface,
} from '@/shared/application/interfaces/clock.interface';

export const FindContentBriefByIdProvider: Provider = {
  provide: FIND_CONTENT_BRIEF_BY_ID_QUERY,
  inject: [CONTENT_BRIEF_QUERY_REPOSITORY, CLOCK],
  useFactory: (
    queryRepository: ContentBriefQueryRepositoryInterface,
    clock: ClockInterface,
  ): FindContentBriefByIdQueryInterface =>
    new FindContentBriefByIdQuery(queryRepository, clock),
};
