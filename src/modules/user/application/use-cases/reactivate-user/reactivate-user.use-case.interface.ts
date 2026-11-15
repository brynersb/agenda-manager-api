import type { UserReadModel } from '@/modules/user/application/interfaces/repositories/user-query.repository.interface';
import type { Actor } from '@/shared/domain/actor';

export type ReactivateUserInput = { id: string; actor: Actor };

export interface ReactivateUserUseCaseInterface {
  execute(input: ReactivateUserInput): Promise<UserReadModel>;
}

export const REACTIVATE_USER_USE_CASE = Symbol(
  'ReactivateUserUseCaseInterface',
);
