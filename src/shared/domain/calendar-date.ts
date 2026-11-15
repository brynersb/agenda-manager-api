import { ValidationError } from '@/shared/domain/errors/domain-error';
import { ValueObject } from '@/shared/domain/value-object';

const MS_PER_DAY = 86_400_000;
const FORMAT = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Data de calendário informada num formato ou valor impossível. */
export class InvalidCalendarDateError extends ValidationError {
  constructor(value: string) {
    super('INVALID_DATE', `Data inválida: "${value}". Use YYYY-MM-DD`);
  }
}

/**
 * Data sem hora (ADR-005), ex.: o `prazo` de uma pauta. A API pública só fala
 * em `YYYY-MM-DD`; a aritmética usa UTC por dentro para não sofrer com horário
 * de verão nem com o fuso do processo.
 */
export class CalendarDate extends ValueObject<{ iso: string }> {
  private constructor(iso: string) {
    super({ iso });
  }

  /** Valida o formato e se a data existe (recusa `2026-02-30`). */
  static of(value: string): CalendarDate {
    const parts = FORMAT.exec(value);
    if (!parts) {
      throw new InvalidCalendarDateError(value);
    }
    const [year, month, day] = [
      Number(parts[1]),
      Number(parts[2]),
      Number(parts[3]),
    ];
    const data = new Date(0);
    data.setUTCFullYear(year, month - 1, day);
    if (
      data.getUTCFullYear() !== year ||
      data.getUTCMonth() !== month - 1 ||
      data.getUTCDate() !== day
    ) {
      throw new InvalidCalendarDateError(value);
    }
    return new CalendarDate(value);
  }

  /** Dia civil de `instant` visto em UTC. Quem precisa de outro fuso usa o `ClockInterface`. */
  static fromUtcInstant(instant: Date): CalendarDate {
    return CalendarDate.of(instant.toISOString().slice(0, 10));
  }

  addDays(amount: number): CalendarDate {
    if (!Number.isInteger(amount)) {
      throw new RangeError('A quantidade de dias deve ser um inteiro');
    }
    return CalendarDate.fromUtcInstant(
      new Date((this.days() + amount) * MS_PER_DAY),
    );
  }

  /** Dias de `this` até `other`: positivo quando `other` é posterior. */
  differenceInDays(other: CalendarDate): number {
    return other.days() - this.days();
  }

  /** `-1` se `this` vem antes, `1` se vem depois, `0` se é o mesmo dia. */
  compareTo(other: CalendarDate): -1 | 0 | 1 {
    return Math.sign(this.days() - other.days()) as -1 | 0 | 1;
  }

  isBefore(other: CalendarDate): boolean {
    return this.compareTo(other) < 0;
  }

  isAfter(other: CalendarDate): boolean {
    return this.compareTo(other) > 0;
  }

  isSame(other: CalendarDate): boolean {
    return this.compareTo(other) === 0;
  }

  toString(): string {
    return this.props.iso;
  }

  toJSON(): string {
    return this.props.iso;
  }

  private days(): number {
    return Date.parse(`${this.props.iso}T00:00:00Z`) / MS_PER_DAY;
  }
}
