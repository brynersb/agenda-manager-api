import { SystemClock } from '@/shared/infrastructure/clock/system-clock';

describe('SystemClock', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('02:30 UTC de 15/11 ainda é dia 14 em São Paulo (virada de dia)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-15T02:30:00Z'));

    expect(new SystemClock('America/Sao_Paulo').today().toString()).toBe(
      '2026-11-14',
    );
    expect(new SystemClock('UTC').today().toString()).toBe('2026-11-15');
  });

  it('03:00 UTC já é dia 15 em São Paulo (UTC-3)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-15T03:00:00Z'));

    expect(new SystemClock('America/Sao_Paulo').today().toString()).toBe(
      '2026-11-15',
    );
  });

  it('now() devolve o instante atual', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-15T02:30:00Z'));

    expect(new SystemClock('UTC').now().toISOString()).toBe(
      '2026-11-15T02:30:00.000Z',
    );
  });
});
