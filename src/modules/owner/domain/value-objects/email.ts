import { ValidationError } from '@/shared/domain/errors/domain-error';
import { ValueObject } from '@/shared/domain/value-object';

const MAX_LENGTH = 254;
/** Formato simples: algo@algo.algo, sem espaços. A entrega real não é verificada. */
const FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** E-mail fora do formato simples ou acima de 254 caracteres. */
export class InvalidEmailError extends ValidationError {
  constructor() {
    super('INVALID_EMAIL', 'Informe um e-mail válido (até 254 caracteres)');
  }
}

/** E-mail opcional de um responsável. */
export class Email extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  /** Valida (depois de `trim`); lança `INVALID_EMAIL`. */
  static create(text: string): Email {
    const value = text.trim();
    if (value.length > MAX_LENGTH || !FORMAT.test(value)) {
      throw new InvalidEmailError();
    }
    return new Email(value);
  }

  /** Texto ausente ou em branco significa "sem e-mail" (`null`). */
  static createOrNull(text: string | null | undefined): Email | null {
    if (text === null || text === undefined || text.trim() === '') {
      return null;
    }
    return Email.create(text);
  }

  /** Reidrata um e-mail já gravado, sem validar de novo. */
  static restore(value: string): Email {
    return new Email(value);
  }

  get value(): string {
    return this.props.value;
  }

  toString(): string {
    return this.props.value;
  }
}
