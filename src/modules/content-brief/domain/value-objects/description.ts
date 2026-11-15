import {
  DESCRIPTION_MAX_LENGTH,
  InvalidDescriptionError,
} from '@/modules/content-brief/domain/errors/content-brief.errors';
import { ValueObject } from '@/shared/domain/value-object';

/** Descrição de uma pauta: sem espaços nas pontas, de 0 a 1200 caracteres. */
export class Description extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  /** Aplica `trim` e valida; lança `INVALID_DESCRIPTION`. */
  static create(text: string): Description {
    const value = text.trim();
    if (Array.from(value).length > DESCRIPTION_MAX_LENGTH) {
      throw new InvalidDescriptionError();
    }
    return new Description(value);
  }

  /** Descrição vazia, o padrão de uma pauta sem texto. */
  static empty(): Description {
    return new Description('');
  }

  /** Reidrata uma descrição já gravada, sem validar de novo. */
  static restore(value: string): Description {
    return new Description(value);
  }

  get value(): string {
    return this.props.value;
  }

  toString(): string {
    return this.props.value;
  }
}
