import { ContentBriefStatus } from '@/modules/content-brief/domain/enums/content-brief-status';
import { DueStatus } from '@/modules/content-brief/domain/enums/due-status';
import type { CalendarDate } from '@/shared/domain/calendar-date';

/** Quantos dias à frente de hoje ainda contam como "próximos 7 dias". */
export const NEXT_DAYS_WINDOW = 7;

export type DueDateClassification = {
  dueStatus: DueStatus;
  /** Dias de hoje até o prazo (negativo quando passou); `null` sem prazo. */
  daysUntilDue: number | null;
};

/**
 * Situação da pauta frente ao prazo (tabela do ADR-005, igual ao `bucket()`
 * do protótipo). A ordem das condições importa: concluída vence tudo, mesmo
 * com prazo vencido. `daysUntilDue` independe do status: existe sempre que
 * há prazo.
 */
export function classifyDueDate(
  dueDate: CalendarDate | null,
  status: ContentBriefStatus,
  today: CalendarDate,
): DueDateClassification {
  const daysUntilDue =
    dueDate === null ? null : today.differenceInDays(dueDate);

  if (status === ContentBriefStatus.DONE) {
    return { dueStatus: DueStatus.COMPLETED, daysUntilDue };
  }
  if (daysUntilDue === null) {
    return { dueStatus: DueStatus.NO_DUE_DATE, daysUntilDue };
  }
  if (daysUntilDue < 0) {
    return { dueStatus: DueStatus.OVERDUE, daysUntilDue };
  }
  if (daysUntilDue === 0) {
    return { dueStatus: DueStatus.TODAY, daysUntilDue };
  }
  if (daysUntilDue <= NEXT_DAYS_WINDOW) {
    return { dueStatus: DueStatus.NEXT_7_DAYS, daysUntilDue };
  }
  return { dueStatus: DueStatus.LATER, daysUntilDue };
}
