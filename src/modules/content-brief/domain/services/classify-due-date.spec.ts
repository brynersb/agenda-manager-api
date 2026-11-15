import { ContentBriefStatus } from '@/modules/content-brief/domain/enums/content-brief-status';
import { DueStatus } from '@/modules/content-brief/domain/enums/due-status';
import { classifyDueDate } from '@/modules/content-brief/domain/services/classify-due-date';
import { CalendarDate } from '@/shared/domain/calendar-date';

const today = CalendarDate.of('2026-11-14');
const day = (offset: number) => today.addDays(offset);

describe('classifyDueDate (tabela do ADR-005)', () => {
  it.each([
    ['hoje -1 (ontem)', -1, DueStatus.OVERDUE],
    ['hoje -30', -30, DueStatus.OVERDUE],
    ['hoje', 0, DueStatus.TODAY],
    ['hoje +1', 1, DueStatus.NEXT_7_DAYS],
    ['hoje +7', 7, DueStatus.NEXT_7_DAYS],
    ['hoje +8', 8, DueStatus.LATER],
    ['hoje +90', 90, DueStatus.LATER],
  ])('pauta aberta com prazo em %s', (_label, offset, expected) => {
    const result = classifyDueDate(day(offset), ContentBriefStatus.TODO, today);

    expect(result).toEqual({ dueStatus: expected, daysUntilDue: offset });
  });

  it('sem prazo: no-due-date e daysUntilDue nulo', () => {
    expect(
      classifyDueDate(null, ContentBriefStatus.IN_PROGRESS, today),
    ).toEqual({ dueStatus: DueStatus.NO_DUE_DATE, daysUntilDue: null });
  });

  it('concluída vence tudo, mesmo com prazo atrasado, e mantém daysUntilDue', () => {
    expect(classifyDueDate(day(-5), ContentBriefStatus.DONE, today)).toEqual({
      dueStatus: DueStatus.COMPLETED,
      daysUntilDue: -5,
    });
  });

  it('concluída sem prazo continua concluída', () => {
    expect(classifyDueDate(null, ContentBriefStatus.DONE, today)).toEqual({
      dueStatus: DueStatus.COMPLETED,
      daysUntilDue: null,
    });
  });

  it.each([
    ContentBriefStatus.TODO,
    ContentBriefStatus.IN_PROGRESS,
    ContentBriefStatus.IN_REVIEW,
  ])('status %s não concluído é classificado pelo prazo', (status) => {
    expect(classifyDueDate(day(-1), status, today).dueStatus).toBe(
      DueStatus.OVERDUE,
    );
  });

  it('atravessa virada de mês e de ano', () => {
    const newYear = CalendarDate.of('2026-12-28');

    expect(
      classifyDueDate(
        CalendarDate.of('2027-01-04'),
        ContentBriefStatus.TODO,
        newYear,
      ),
    ).toEqual({ dueStatus: DueStatus.NEXT_7_DAYS, daysUntilDue: 7 });
  });
});
