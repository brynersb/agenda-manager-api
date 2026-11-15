import { ValidationError } from '@/shared/domain/errors/domain-error';
import { ValueObject } from '@/shared/domain/value-object';

const MAX_LENGTH = 80;

/** Nome de cadastro (empreendimento, responsável) fora de 1..80 caracteres. */
export class InvalidRegistryNameError extends ValidationError {
  constructor() {
    super(
      'INVALID_REGISTRY_NAME',
      `O nome deve ter entre 1 e ${MAX_LENGTH} caracteres`,
    );
  }
}

/**
 * Nome de um cadastro: sem espaços nas pontas, com os espaços internos
 * colapsados para um e de 1 a 80 caracteres (contados depois de normalizar).
 * Dois nomes são o mesmo cadastro quando o `normalized` (sem caixa e sem
 * acento) coincide, a regra de dedupe do protótipo.
 */
export class RegistryName extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  /** Normaliza e valida; lança `INVALID_REGISTRY_NAME`. */
  static create(text: string): RegistryName {
    const value = text.trim().replace(/\s+/g, ' ');
    const length = Array.from(value).length;
    if (length < 1 || length > MAX_LENGTH) {
      throw new InvalidRegistryNameError();
    }
    return new RegistryName(value);
  }

  /** Reidrata um nome já gravado, sem validar de novo. */
  static restore(value: string): RegistryName {
    return new RegistryName(value);
  }

  get value(): string {
    return this.props.value;
  }

  /** Chave de unicidade: minúsculas e sem diacríticos (`Ipê` -> `ipe`). */
  get normalized(): string {
    return this.props.value
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');
  }

  override equals(other: unknown): boolean {
    return (
      other instanceof RegistryName && other.normalized === this.normalized
    );
  }

  toString(): string {
    return this.props.value;
  }
}
