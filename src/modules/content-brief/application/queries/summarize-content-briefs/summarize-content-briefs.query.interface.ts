import type { ContentBriefCounts } from '@/modules/content-brief/application/interfaces/repositories/content-brief-query.repository.interface';
import type { ContentBriefAction } from '@/modules/content-brief/domain/enums/content-brief-action';
import type { ContentBriefStatus } from '@/modules/content-brief/domain/enums/content-brief-status';
import type { CalendarDate } from '@/shared/domain/calendar-date';

export type SummarizeContentBriefsInput = {
  status?: ContentBriefStatus[];
  /** Uuid ou `none` (sem empreendimento). */
  estateDevelopmentId?: string;
  /** Uuid ou `none` (sem responsável). */
  ownerId?: string;
  action?: ContentBriefAction;
  /** Texto da busca, já sem espaços nas pontas. */
  q?: string;
};

export type ContentBriefSummary = ContentBriefCounts & {
  /** Dia de referência usado nas contagens por situação do prazo. */
  today: CalendarDate;
};

export interface SummarizeContentBriefsQueryInterface {
  execute(input: SummarizeContentBriefsInput): Promise<ContentBriefSummary>;
}

export const SUMMARIZE_CONTENT_BRIEFS_QUERY = Symbol(
  'SummarizeContentBriefsQueryInterface',
);
