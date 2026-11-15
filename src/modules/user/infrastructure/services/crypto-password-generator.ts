import { randomInt } from 'node:crypto';

import type { PasswordGeneratorInterface } from '@/modules/user/application/interfaces/password-generator.interface';

/** Alfabetos sem caracteres ambíguos (I, l, O, 0, 1): a senha é lida e digitada por gente. */
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%&*?-_=+';
const ALL = UPPER + LOWER + DIGITS + SYMBOLS;

const LENGTH = 16;

function pick(alphabet: string): string {
  return alphabet[randomInt(alphabet.length)];
}

/**
 * Gera a senha provisória com o `crypto.randomInt` (CSPRNG): 16 caracteres, com
 * pelo menos um de cada classe, embaralhados (Fisher-Yates com o mesmo CSPRNG).
 */
export class CryptoPasswordGenerator implements PasswordGeneratorInterface {
  generate(): string {
    const chars = [
      pick(UPPER),
      pick(LOWER),
      pick(DIGITS),
      pick(SYMBOLS),
      ...Array.from({ length: LENGTH - 4 }, () => pick(ALL)),
    ];
    for (let i = chars.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
  }
}
