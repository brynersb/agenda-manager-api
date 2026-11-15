import {
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
} from '@/shared/domain/errors/domain-error';

/** Qualquer falha de autenticação por token; o motivo detalhado vai só para o log. */
export class UnauthenticatedError extends UnauthorizedError {
  constructor() {
    super('UNAUTHENTICATED', 'Não autenticado.');
  }
}

export class ForbiddenAccessError extends ForbiddenError {
  constructor() {
    super('FORBIDDEN', 'Você não tem permissão para esta ação.');
  }
}

/**
 * E-mail inexistente e senha errada devolvem exatamente esta mesma resposta
 * (e gastam o mesmo tempo), para ninguém descobrir quais e-mails existem.
 */
export class InvalidCredentialsError extends UnauthorizedError {
  constructor() {
    super('INVALID_CREDENTIALS', 'E-mail ou senha inválidos.');
  }
}

/** Conta bloqueada por excesso de tentativas; `minutes` é o tempo que falta, arredondado para cima. */
export class AccountLockedError extends ForbiddenError {
  constructor(minutes: number) {
    super(
      'ACCOUNT_LOCKED',
      `Conta bloqueada por excesso de tentativas. Tente novamente em ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}.`,
    );
  }
}

/** Usuário desativado tentou entrar ou renovar a sessão (só depois de provar a senha ou o refresh token). */
export class UserDeactivatedError extends ForbiddenError {
  constructor() {
    super('USER_DEACTIVATED', 'Usuário desativado. Procure um administrador.');
  }
}

/** Refresh token desconhecido, expirado, revogado ou reutilizado. */
export class InvalidRefreshTokenError extends UnauthorizedError {
  constructor() {
    super(
      'INVALID_REFRESH_TOKEN',
      'Sessão inválida ou expirada. Entre novamente.',
    );
  }
}

/** A senha atual informada na troca de senha não confere (400, para o front não tratar como sessão expirada). */
export class InvalidCurrentPasswordError extends ValidationError {
  constructor() {
    super('INVALID_CURRENT_PASSWORD', 'A senha atual não confere.');
  }
}
