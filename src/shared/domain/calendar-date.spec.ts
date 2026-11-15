import { CalendarDate } from '@/shared/domain/calendar-date';

describe('CalendarDate', () => {
  it('aceita uma data válida e devolve YYYY-MM-DD', () => {
    expect(CalendarDate.of('2026-11-14').toString()).toBe('2026-11-14');
    expect(JSON.stringify({ d: CalendarDate.of('2026-11-14') })).toBe(
      '{"d":"2026-11-14"}',
    );
  });

  it.each([
    '2026-02-30',
    '2026-13-01',
    '2026-00-10',
    '2026-04-31',
    '2026-1-1',
    '14/11/2026',
    '2026-11-14T00:00:00Z',
    '',
    ' 2026-11-14',
  ])('recusa "%s"', (value) => {
    expect(() => CalendarDate.of(value)).toThrowError(
      expect.objectContaining({ code: 'INVALID_DATE', kind: 'VALIDATION' }),
    );
  });

  it('trata o ano bissexto', () => {
    expect(CalendarDate.of('2024-02-29').toString()).toBe('2024-02-29');
    expect(() => CalendarDate.of('2026-02-29')).toThrow();
    expect(() => CalendarDate.of('1900-02-29')).toThrow();
    expect(CalendarDate.of('2000-02-29').toString()).toBe('2000-02-29');
    expect(CalendarDate.of('2024-02-28').addDays(1).toString()).toBe(
      '2024-02-29',
    );
    expect(CalendarDate.of('2026-02-28').addDays(1).toString()).toBe(
      '2026-03-01',
    );
  });

  it('soma e subtrai dias atravessando mês e ano', () => {
    const data = CalendarDate.of('2026-12-30');

    expect(data.addDays(3).toString()).toBe('2027-01-02');
    expect(data.addDays(-30).toString()).toBe('2026-11-30');
    expect(data.addDays(0).isSame(data)).toBe(true);
    expect(() => data.addDays(1.5)).toThrow(RangeError);
  });

  it('calcula a diferença em dias com sinal', () => {
    const a = CalendarDate.of('2026-11-14');
    const b = CalendarDate.of('2026-11-21');

    expect(a.differenceInDays(b)).toBe(7);
    expect(b.differenceInDays(a)).toBe(-7);
    expect(a.differenceInDays(a)).toBe(0);
    expect(
      CalendarDate.of('2024-02-28').differenceInDays(
        CalendarDate.of('2024-03-01'),
      ),
    ).toBe(2);
  });

  it('compara datas', () => {
    const a = CalendarDate.of('2026-11-14');
    const b = CalendarDate.of('2026-11-15');

    expect(a.compareTo(b)).toBe(-1);
    expect(b.compareTo(a)).toBe(1);
    expect(a.compareTo(CalendarDate.of('2026-11-14'))).toBe(0);
    expect(a.isBefore(b)).toBe(true);
    expect(a.isAfter(b)).toBe(false);
    expect(b.isAfter(a)).toBe(true);
    expect(a.isSame(CalendarDate.of('2026-11-14'))).toBe(true);
    expect(a.equals(CalendarDate.of('2026-11-14'))).toBe(true);
  });

  it('cria a partir do dia UTC de um instante', () => {
    expect(
      CalendarDate.fromUtcInstant(new Date('2026-11-15T02:30:00Z')).toString(),
    ).toBe('2026-11-15');
  });
});
