import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '@/shared/domain/errors/domain-error';

export class UserNotFoundError extends NotFoundError {
  constructor() {
    super('USER_NOT_FOUND', 'Usuário não encontrado');
  }
}

/** Já existe usuário com o mesmo e-mail (sem diferenciar caixa), ativo ou desativado. */
export class EmailAlreadyRegisteredError extends ConflictError {
  constructor() {
    super('EMAIL_ALREADY_REGISTERED', 'Já existe um usuário com este e-mail.');
  }
}

export class UserVersionOutdatedError extends ConflictError {
  constructor() {
    super(
      'USER_VERSION_OUTDATED',
      'Este usuário foi alterado por outra pessoa. Recarregue para ver a versão atual.',
    );
  }
}

/** A operação deixaria o sistema sem nenhum administrador ativo. */
export class LastAdminError extends ConflictError {
  constructor() {
    super(
      'LAST_ADMIN',
      'Esta operação deixaria o sistema sem administrador ativo. Cadastre ou reative outro administrador antes.',
    );
  }
}

/** Desativar ou rebaixar a si mesmo é proibido (evita se trancar para fora). */
export class CannotModifySelfError extends ConflictError {
  constructor() {
    super(
      'CANNOT_MODIFY_SELF',
      'Você não pode desativar nem alterar o papel da sua própria conta.',
    );
  }
}

/** Senha fora da política (tamanho) ou igual à atual. */
export class WeakPasswordError extends ValidationError {
  constructor(message: string) {
    super('WEAK_PASSWORD', message);
  }
}

export class InvalidUserNameError extends ValidationError {
  constructor() {
    super('INVALID_USER_NAME', 'O nome deve ter entre 1 e 120 caracteres');
  }
}

/** Mesmo `code` do e-mail de responsável: o front trata os dois igual. */
export class InvalidUserEmailError extends ValidationError {
  constructor() {
    super('INVALID_EMAIL', 'Informe um e-mail válido (até 254 caracteres)');
  }
}
