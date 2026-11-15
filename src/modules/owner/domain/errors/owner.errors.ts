import {
  ConflictError,
  NotFoundError,
} from '@/shared/domain/errors/domain-error';

export class OwnerNotFoundError extends NotFoundError {
  constructor() {
    super('OWNER_NOT_FOUND', 'Responsável não encontrado');
  }
}

/**
 * Já existe um responsável com o mesmo nome (sem caixa e sem acento). Se o
 * homônimo está arquivado, a mensagem orienta a reativá-lo.
 */
export class OwnerNameDuplicatedError extends ConflictError {
  constructor(namesakeArchived = false) {
    super(
      'OWNER_NAME_DUPLICATED',
      namesakeArchived
        ? 'Já existe um responsável arquivado com este nome. Reative-o em vez de criar outro.'
        : 'Já existe um responsável com este nome.',
    );
  }
}

export class OwnerVersionOutdatedError extends ConflictError {
  constructor() {
    super(
      'OWNER_VERSION_OUTDATED',
      'Este responsável foi alterado por outra pessoa. Recarregue para ver a versão atual.',
    );
  }
}
