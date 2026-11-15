import { FixedClock } from '@/shared/infrastructure/clock/fixed-clock';

describe('FixedClock', () => {
  it('começa em 2026-11-14 e pode ser alterado', () => {
    const clock = new FixedClock();

    expect(clock.today().toString()).toBe('2026-11-14');
    expect(clock.now().toISOString()).toBe('2026-11-14T12:00:00.000Z');

    clock.setToday('2026-12-01');

    expect(clock.today().toString()).toBe('2026-12-01');
    expect(clock.now().toISOString()).toBe('2026-12-01T12:00:00.000Z');
  });
});
