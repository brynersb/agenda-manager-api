import {
  InvalidTitleError,
  TITLE_MAX_LENGTH,
} from '@/modules/content-brief/domain/errors/content-brief.errors';
import { ValueObject } from '@/shared/domain/value-object';

/** Título de uma pauta: sem espaços nas pontas, de 1 a 140 caracteres. */
export class Title extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  /** Aplica `trim` e valida; lança `INVALID_TITLE`. */
  static create(text: string): Title {
    const value = text.trim();
    const length = Array.from(value).length;
    if (length < 1 || length > TITLE_MAX_LENGTH) {
      throw new InvalidTitleError();
    }
    return new Title(value);
  }

  /** Reidrata um título já gravado, sem validar de novo. */
  static restore(value: string): Title {
    return new Title(value);
  }

  get value(): string {
    return this.props.value;
  }

  toString(): string {
    return this.props.value;
  }
}
