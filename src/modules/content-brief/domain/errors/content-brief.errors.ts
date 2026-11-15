import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '@/shared/domain/errors/domain-error';

export const TITLE_MAX_LENGTH = 140;
export const DESCRIPTION_MAX_LENGTH = 1200;

export class ContentBriefNotFoundError extends NotFoundError {
  constructor() {
    super('CONTENT_BRIEF_NOT_FOUND', 'Pauta não encontrada');
  }
}

export class ContentBriefVersionOutdatedError extends ConflictError {
  constructor() {
    super(
      'CONTENT_BRIEF_VERSION_OUTDATED',
      'Esta pauta foi alterada por outra pessoa. Recarregue para ver a versão atual.',
    );
  }
}

/** Título fora de 1..140 caracteres (depois de `trim`). */
export class InvalidTitleError extends ValidationError {
  constructor() {
    super(
      'INVALID_TITLE',
      `O título deve ter entre 1 e ${TITLE_MAX_LENGTH} caracteres`,
    );
  }
}

/** Descrição acima de 1200 caracteres (depois de `trim`). */
export class InvalidDescriptionError extends ValidationError {
  constructor() {
    super(
      'INVALID_DESCRIPTION',
      `A descrição deve ter no máximo ${DESCRIPTION_MAX_LENGTH} caracteres`,
    );
  }
}

/**
 * Prazo que passou do formato mas não é uma data existente (ex.:
 * `2026-02-30`). Usa o `code` genérico `INVALID_REQUEST` do catálogo, no
 * lugar do `INVALID_DATE` do value object de data, que não é um código
 * público.
 */
export class InvalidDueDateError extends ValidationError {
  constructor(value: string) {
    super(
      'INVALID_REQUEST',
      `Prazo inválido: "${value}". Use uma data existente no formato YYYY-MM-DD`,
    );
  }
}

/**
 * Empreendimento que não pode ser atribuído à pauta: não existe ou está
 * arquivado. Manter um já atribuído e depois arquivado continua permitido.
 */
export class EstateDevelopmentUnavailableError extends ValidationError {
  constructor(reason: 'archived' | 'missing') {
    super(
      'ESTATE_DEVELOPMENT_UNAVAILABLE',
      reason === 'archived'
        ? 'O empreendimento está arquivado e não pode ser atribuído a uma pauta'
        : 'O empreendimento informado não existe',
    );
  }
}

/** Responsável que não pode ser atribuído à pauta: não existe ou está arquivado. */
export class OwnerUnavailableError extends ValidationError {
  constructor(reason: 'archived' | 'missing') {
    super(
      'OWNER_UNAVAILABLE',
      reason === 'archived'
        ? 'O responsável está arquivado e não pode ser atribuído a uma pauta'
        : 'O responsável informado não existe',
    );
  }
}
