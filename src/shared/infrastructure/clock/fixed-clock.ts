import type { ClockInterface } from '@/shared/application/interfaces/clock.interface';
import { CalendarDate } from '@/shared/domain/calendar-date';

/** Data padrão dos testes. */
export const DEFAULT_TEST_TODAY = '2026-11-14';

/**
 * Relógio controlado para testes (unitários e e2e). `now()` fica ao
 * meio-dia UTC de `today()`, longe de qualquer virada de dia nos fusos usados;
 * `advanceMinutes` desloca o instante dentro do dia (ex.: fim de um bloqueio
 * de login) sem mudar `today()`.
 */
export class FixedClock implements ClockInterface {
  private data: CalendarDate;
  private offsetMs = 0;

  constructor(today: string | CalendarDate = DEFAULT_TEST_TODAY) {
    this.data = typeof today === 'string' ? CalendarDate.of(today) : today;
  }

  /** Muda o dia corrente do relógio (ex.: `setToday('2026-12-01')`). */
  setToday(today: string | CalendarDate): void {
    this.data = typeof today === 'string' ? CalendarDate.of(today) : today;
    this.offsetMs = 0;
  }

  /** Avança o instante de `now()` (não altera `today()`); acumula entre chamadas. */
  advanceMinutes(minutes: number): void {
    this.offsetMs += minutes * 60_000;
  }

  today(): CalendarDate {
    return this.data;
  }

  now(): Date {
    return new Date(
      new Date(`${this.data.toString()}T12:00:00.000Z`).getTime() +
        this.offsetMs,
    );
  }
}
