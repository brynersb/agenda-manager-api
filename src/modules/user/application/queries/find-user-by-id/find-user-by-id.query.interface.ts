import type { UserReadModel } from '@/modules/user/application/interfaces/repositories/user-query.repository.interface';

export interface FindUserByIdQueryInterface {
  /** Lança `UserNotFoundError` quando não existe. */
  execute(id: string): Promise<UserReadModel>;
}

export const FIND_USER_BY_ID_QUERY = Symbol('FindUserByIdQueryInterface');
