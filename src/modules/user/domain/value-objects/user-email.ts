import { InvalidUserEmailError } from '@/modules/user/domain/errors/user.errors';
import { ValueObject } from '@/shared/domain/value-object';

const MAX_LENGTH = 254;
/** Formato simples: algo@algo.algo, sem espaços. A entrega real não é verificada. */
const FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * E-mail de login: `trim` + minúsculas, de modo que "Ana@X.com" e "ana@x.com"
 * são a mesma conta (a unicidade no banco é sobre `lower(email)`).
 */
export class UserEmail extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  /** Normaliza sem validar: usado no login, onde formato ruim é só "credenciais inválidas". */
  static normalize(text: string): string {
    return text.trim().toLowerCase();
  }

  /** Normaliza e valida; lança `INVALID_EMAIL`. */
  static create(text: string): UserEmail {
    const value = UserEmail.normalize(text);
    if (value.length > MAX_LENGTH || !FORMAT.test(value)) {
      throw new InvalidUserEmailError();
    }
    return new UserEmail(value);
  }

  /** Reidrata um e-mail já gravado, sem validar de novo. */
  static restore(value: string): UserEmail {
    return new UserEmail(value);
  }

  get value(): string {
    return this.props.value;
  }

  toString(): string {
    return this.props.value;
  }
}
