import type { UserReadModel } from '@/modules/user/application/interfaces/repositories/user-query.repository.interface';
import type { Actor } from '@/shared/domain/actor';

export type ResetUserPasswordInput = { id: string; actor: Actor };

export type ResetUserPasswordResult = {
  user: UserReadModel;
  /** Senha provisória, devolvida **uma única vez** (nunca mais recuperável). */
  temporaryPassword: string;
};

export interface ResetUserPasswordUseCaseInterface {
  execute(input: ResetUserPasswordInput): Promise<ResetUserPasswordResult>;
}

export const RESET_USER_PASSWORD_USE_CASE = Symbol(
  'ResetUserPasswordUseCaseInterface',
);
