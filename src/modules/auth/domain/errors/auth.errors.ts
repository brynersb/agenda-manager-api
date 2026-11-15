import {
  ForbiddenError,
  UnauthorizedError,
} from '@/shared/domain/errors/domain-error';

/** Qualquer falha de autenticação; o motivo detalhado vai só para o log. */
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
