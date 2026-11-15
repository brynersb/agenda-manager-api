import { WeakPasswordError } from '@/modules/user/domain/errors/user.errors';
import {
  assertPasswordPolicy,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from '@/modules/user/domain/services/password-policy';

describe('assertPasswordPolicy', () => {
  it('aceita de 10 a 128 caracteres', () => {
    expect(() => assertPasswordPolicy('a'.repeat(10))).not.toThrow();
    expect(() => assertPasswordPolicy('a'.repeat(128))).not.toThrow();
  });

  it('recusa 9 e 129 caracteres com WEAK_PASSWORD', () => {
    for (const size of [MIN_PASSWORD_LENGTH - 1, MAX_PASSWORD_LENGTH + 1]) {
      expect(() => assertPasswordPolicy('a'.repeat(size))).toThrow(
        WeakPasswordError,
      );
      expect(() => assertPasswordPolicy('a'.repeat(size))).toThrow(
        expect.objectContaining({ code: 'WEAK_PASSWORD', kind: 'VALIDATION' }),
      );
    }
  });

  it('conta caracteres Unicode, não unidades UTF-16', () => {
    // 5 emojis = 10 unidades UTF-16, mas só 5 caracteres.
    expect(() => assertPasswordPolicy('😀'.repeat(5))).toThrow(
      WeakPasswordError,
    );
    expect(() => assertPasswordPolicy('😀'.repeat(10))).not.toThrow();
  });

  it('recusa senha vazia', () => {
    expect(() => assertPasswordPolicy('')).toThrow(WeakPasswordError);
  });
});
