import type { Provider } from '@nestjs/common';

import {
  CONTENT_BRIEF_QUERY_REPOSITORY,
  type ContentBriefQueryRepositoryInterface,
} from '@/modules/content-brief/application/interfaces/repositories/content-brief-query.repository.interface';
import { ListContentBriefsQuery } from '@/modules/content-brief/application/queries/list-content-briefs/list-content-briefs.query';
import {
  LIST_CONTENT_BRIEFS_QUERY,
  type ListContentBriefsQueryInterface,
} from '@/modules/content-brief/application/queries/list-content-briefs/list-content-briefs.query.interface';
import {
  CLOCK,
  type ClockInterface,
} from '@/shared/application/interfaces/clock.interface';

export const ListContentBriefsProvider: Provider = {
  provide: LIST_CONTENT_BRIEFS_QUERY,
  inject: [CONTENT_BRIEF_QUERY_REPOSITORY, CLOCK],
  useFactory: (
    queryRepository: ContentBriefQueryRepositoryInterface,
    clock: ClockInterface,
  ): ListContentBriefsQueryInterface =>
    new ListContentBriefsQuery(queryRepository, clock),
};
