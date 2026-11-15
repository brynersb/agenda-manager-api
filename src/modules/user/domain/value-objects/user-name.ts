import { InvalidUserNameError } from '@/modules/user/domain/errors/user.errors';
import { ValueObject } from '@/shared/domain/value-object';

const MAX_LENGTH = 120;

/**
 * Nome de exibição do usuário: sem espaços nas pontas, espaços internos
 * colapsados, de 1 a 120 caracteres (cabe no snapshot `*_by_name` da auditoria).
 */
export class UserName extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  static create(text: string): UserName {
    const value = text.trim().replace(/\s+/g, ' ');
    const length = Array.from(value).length;
    if (length < 1 || length > MAX_LENGTH) {
      throw new InvalidUserNameError();
    }
    return new UserName(value);
  }

  /** Reidrata um nome já gravado, sem validar de novo. */
  static restore(value: string): UserName {
    return new UserName(value);
  }

  get value(): string {
    return this.props.value;
  }

  toString(): string {
    return this.props.value;
  }
}
