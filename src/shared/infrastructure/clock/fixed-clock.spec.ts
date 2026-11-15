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

describe('FixedClock.advanceMinutes', () => {
  it('desloca now() sem mudar today() e zera ao trocar o dia', () => {
    const clock = new FixedClock();

    clock.advanceMinutes(16);
    clock.advanceMinutes(4);

    expect(clock.now().toISOString()).toBe('2026-11-14T12:20:00.000Z');
    expect(clock.today().toString()).toBe('2026-11-14');

    clock.setToday('2026-11-14');

    expect(clock.now().toISOString()).toBe('2026-11-14T12:00:00.000Z');
  });
});
