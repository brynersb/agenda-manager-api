import type { Role } from '@/modules/auth/domain/enums/role';
import type { UserReadModel } from '@/modules/user/application/interfaces/repositories/user-query.repository.interface';
import type { Actor } from '@/shared/domain/actor';

export type CreateUserInput = {
  name: string;
  email: string;
  role: Role;
  /** Omitida: a API gera uma senha provisória forte. */
  password?: string;
  actor: Actor;
};

export type CreateUserResult = {
  user: UserReadModel;
  /**
   * Senha provisória gerada, devolvida **uma única vez** (nunca mais
   * recuperável). `null` quando o administrador informou a senha.
   */
  temporaryPassword: string | null;
};

export interface CreateUserUseCaseInterface {
  execute(input: CreateUserInput): Promise<CreateUserResult>;
}

export const CREATE_USER_USE_CASE = Symbol('CreateUserUseCaseInterface');
