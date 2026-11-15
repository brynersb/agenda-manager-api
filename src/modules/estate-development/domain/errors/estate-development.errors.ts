import {
  ConflictError,
  NotFoundError,
} from '@/shared/domain/errors/domain-error';

export class EstateDevelopmentNotFoundError extends NotFoundError {
  constructor() {
    super('ESTATE_DEVELOPMENT_NOT_FOUND', 'Empreendimento não encontrado');
  }
}

/**
 * Já existe um empreendimento com o mesmo nome (sem caixa e sem acento). Se o
 * homônimo está arquivado, a mensagem orienta a reativá-lo.
 */
export class EstateDevelopmentNameDuplicatedError extends ConflictError {
  constructor(namesakeArchived = false) {
    super(
      'ESTATE_DEVELOPMENT_NAME_DUPLICATED',
      namesakeArchived
        ? 'Já existe um empreendimento arquivado com este nome. Reative-o em vez de criar outro.'
        : 'Já existe um empreendimento com este nome.',
    );
  }
}

export class EstateDevelopmentVersionOutdatedError extends ConflictError {
  constructor() {
    super(
      'ESTATE_DEVELOPMENT_VERSION_OUTDATED',
      'Este empreendimento foi alterado por outra pessoa. Recarregue para ver a versão atual.',
    );
  }
}
