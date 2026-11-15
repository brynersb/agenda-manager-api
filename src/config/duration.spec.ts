import { DURATION_PATTERN, parseDurationToSeconds } from '@/config/duration';

describe('parseDurationToSeconds', () => {
  it.each([
    ['30s', 30],
    ['15m', 900],
    ['2h', 7200],
    ['7d', 604_800],
  ])('converte %s em %i segundos', (text, seconds) => {
    expect(parseDurationToSeconds(text)).toBe(seconds);
  });

  it.each(['', '15', 'm', '0m', '-5m', '1.5h', '15 m', '15M', '1w'])(
    'recusa "%s"',
    (text) => {
      expect(DURATION_PATTERN.test(text)).toBe(false);
      expect(() => parseDurationToSeconds(text)).toThrow(RangeError);
    },
  );
});
