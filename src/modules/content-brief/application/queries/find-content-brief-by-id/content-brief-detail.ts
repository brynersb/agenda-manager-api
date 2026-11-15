import type { ContentBriefReadModel } from '@/modules/content-brief/application/interfaces/repositories/content-brief-query.repository.interface';
import type { DueStatus } from '@/modules/content-brief/domain/enums/due-status';
import { classifyDueDate } from '@/modules/content-brief/domain/services/classify-due-date';
import type { CalendarDate } from '@/shared/domain/calendar-date';

/** Pauta pronta para a resposta: read model mais a situação do prazo. */
export type ContentBriefDetail = ContentBriefReadModel & {
  dueStatus: DueStatus;
  daysUntilDue: number | null;
};

/** Acrescenta `dueStatus` e `daysUntilDue` (ADR-005) em relação a `today`. */
export function withDueStatus(
  contentBrief: ContentBriefReadModel,
  today: CalendarDate,
): ContentBriefDetail {
  return {
    ...contentBrief,
    ...classifyDueDate(contentBrief.dueDate, contentBrief.status, today),
  };
}
