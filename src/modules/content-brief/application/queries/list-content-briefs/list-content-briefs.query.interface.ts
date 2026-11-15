import type { ContentBriefDetail } from '@/modules/content-brief/application/queries/find-content-brief-by-id/content-brief-detail';
import type { ContentBriefAction } from '@/modules/content-brief/domain/enums/content-brief-action';
import type { ContentBriefSort } from '@/modules/content-brief/domain/enums/content-brief-sort';
import type { ContentBriefStatus } from '@/modules/content-brief/domain/enums/content-brief-status';
import type { DueStatus } from '@/modules/content-brief/domain/enums/due-status';

export type ListContentBriefsInput = {
  dueStatus?: DueStatus[];
  status?: ContentBriefStatus[];
  /** Uuid ou `none` (sem empreendimento). */
  estateDevelopmentId?: string;
  /** Uuid ou `none` (sem responsável). */
  ownerId?: string;
  action?: ContentBriefAction;
  /** Texto da busca, já sem espaços nas pontas. */
  q?: string;
  sort: ContentBriefSort;
  page: number;
  limit: number;
};

export type ListContentBriefsResult = {
  data: ContentBriefDetail[];
  /** Total que casa com o filtro, sem paginar. */
  total: number;
  page: number;
  limit: number;
};

export interface ListContentBriefsQueryInterface {
  execute(input: ListContentBriefsInput): Promise<ListContentBriefsResult>;
}

export const LIST_CONTENT_BRIEFS_QUERY = Symbol(
  'ListContentBriefsQueryInterface',
);
