import { WeakPasswordError } from '@/modules/user/domain/errors/user.errors';

export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 128;

/**
 * Política de senha: de 10 a 128 caracteres (contados por caractere Unicode).
 * O máximo existe para limitar o custo do hash, não por segurança.
 * Lança `WEAK_PASSWORD`.
 */
export function assertPasswordPolicy(password: string): void {
  const length = Array.from(password).length;
  if (length < MIN_PASSWORD_LENGTH || length > MAX_PASSWORD_LENGTH) {
    throw new WeakPasswordError(
      `A senha deve ter entre ${MIN_PASSWORD_LENGTH} e ${MAX_PASSWORD_LENGTH} caracteres.`,
    );
  }
}
