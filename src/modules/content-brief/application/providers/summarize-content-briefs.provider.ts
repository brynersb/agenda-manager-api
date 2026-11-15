import type { Provider } from '@nestjs/common';

import {
  CONTENT_BRIEF_QUERY_REPOSITORY,
  type ContentBriefQueryRepositoryInterface,
} from '@/modules/content-brief/application/interfaces/repositories/content-brief-query.repository.interface';
import { SummarizeContentBriefsQuery } from '@/modules/content-brief/application/queries/summarize-content-briefs/summarize-content-briefs.query';
import {
  SUMMARIZE_CONTENT_BRIEFS_QUERY,
  type SummarizeContentBriefsQueryInterface,
} from '@/modules/content-brief/application/queries/summarize-content-briefs/summarize-content-briefs.query.interface';
import {
  CLOCK,
  type ClockInterface,
} from '@/shared/application/interfaces/clock.interface';

export const SummarizeContentBriefsProvider: Provider = {
  provide: SUMMARIZE_CONTENT_BRIEFS_QUERY,
  inject: [CONTENT_BRIEF_QUERY_REPOSITORY, CLOCK],
  useFactory: (
    queryRepository: ContentBriefQueryRepositoryInterface,
    clock: ClockInterface,
  ): SummarizeContentBriefsQueryInterface =>
    new SummarizeContentBriefsQuery(queryRepository, clock),
};
