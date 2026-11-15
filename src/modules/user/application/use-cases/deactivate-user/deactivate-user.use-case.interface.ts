import type { UserReadModel } from '@/modules/user/application/interfaces/repositories/user-query.repository.interface';
import type { Actor } from '@/shared/domain/actor';

export type DeactivateUserInput = { id: string; actor: Actor };

export interface DeactivateUserUseCaseInterface {
  execute(input: DeactivateUserInput): Promise<UserReadModel>;
}

export const DEACTIVATE_USER_USE_CASE = Symbol(
  'DeactivateUserUseCaseInterface',
);
