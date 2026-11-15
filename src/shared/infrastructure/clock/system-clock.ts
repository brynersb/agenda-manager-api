import type { ClockInterface } from '@/shared/application/interfaces/clock.interface';
import { CalendarDate } from '@/shared/domain/calendar-date';

/** Relógio real: "hoje" é o dia civil no fuso `timeZone` (IANA). */
export class SystemClock implements ClockInterface {
  private readonly formatter: Intl.DateTimeFormat;

  constructor(timeZone: string) {
    this.formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }

  today(): CalendarDate {
    const parts = Object.fromEntries(
      this.formatter
        .formatToParts(this.now())
        .map(({ type, value }) => [type, value]),
    );
    return CalendarDate.of(`${parts.year}-${parts.month}-${parts.day}`);
  }

  now(): Date {
    return new Date();
  }
}
