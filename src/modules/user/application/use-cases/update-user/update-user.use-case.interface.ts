import type { Role } from '@/modules/auth/domain/enums/role';
import type { UserReadModel } from '@/modules/user/application/interfaces/repositories/user-query.repository.interface';
import type { Actor } from '@/shared/domain/actor';

export type UpdateUserInput = {
  id: string;
  /** Omitido mantém o atual. */
  name?: string;
  /** Omitido mantém o atual. Não vale para a própria conta. */
  role?: Role;
  /** Versão que o cliente leu; divergência vira 409 (ADR-006). */
  version: number;
  actor: Actor;
};

export interface UpdateUserUseCaseInterface {
  execute(input: UpdateUserInput): Promise<UserReadModel>;
}

export const UPDATE_USER_USE_CASE = Symbol('UpdateUserUseCaseInterface');
