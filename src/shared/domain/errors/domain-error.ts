/** Categoria do erro; o filtro global traduz cada uma num status HTTP. */
export type DomainErrorKind =
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'FORBIDDEN'
  | 'UNAUTHORIZED';

/**
 * Erro de regra de negócio. Não conhece HTTP (ADR-008): `kind` diz a categoria,
 * `code` é o identificador estável que o front usa para escolher a mensagem e
 * `message` é o texto em pt-BR para quem lê o log ou a resposta.
 */
export abstract class DomainError extends Error {
  abstract readonly kind: DomainErrorKind;

  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends DomainError {
  readonly kind = 'NOT_FOUND';
}

export class ValidationError extends DomainError {
  readonly kind = 'VALIDATION';
}

export class ConflictError extends DomainError {
  readonly kind = 'CONFLICT';
}

export class ForbiddenError extends DomainError {
  readonly kind = 'FORBIDDEN';
}

export class UnauthorizedError extends DomainError {
  readonly kind = 'UNAUTHORIZED';
}
