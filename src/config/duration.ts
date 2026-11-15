/** Formato aceito para TTLs: inteiro positivo + `s`, `m`, `h` ou `d` (ex.: `15m`, `7d`). */
export const DURATION_PATTERN = /^([1-9]\d*)([smhd])$/;

const SECONDS_PER_UNIT: Record<string, number> = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86_400,
};

/** Converte `15m`, `7d`... em segundos. Lança `RangeError` se o formato for inválido. */
export function parseDurationToSeconds(value: string): number {
  const match = DURATION_PATTERN.exec(value);
  if (!match) {
    throw new RangeError(
      `Duração inválida: "${value}". Use um inteiro positivo seguido de s, m, h ou d (ex.: 15m, 7d)`,
    );
  }
  return Number(match[1]) * SECONDS_PER_UNIT[match[2]];
}
