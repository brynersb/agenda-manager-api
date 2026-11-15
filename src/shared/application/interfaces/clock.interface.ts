import type { CalendarDate } from '@/shared/domain/calendar-date';

/**
 * Fonte de "now" e de "today" (ADR-005). `today()` é o dia civil no fuso da
 * operação (`APP_TIMEZONE`); testes injetam um relógio fixo.
 */
export interface ClockInterface {
  today(): CalendarDate;
  now(): Date;
}

export const CLOCK = Symbol('ClockInterface');
