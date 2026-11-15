import type { UserReadModel } from '@/modules/user/application/interfaces/repositories/user-query.repository.interface';
import type { UserStatus } from '@/modules/user/domain/enums/user-status';

export type ListUsersInput = {
  /** Texto da busca (nome ou e-mail), já sem espaços nas pontas. */
  q?: string;
  status?: UserStatus;
  page: number;
  limit: number;
};

export type ListUsersResult = {
  data: UserReadModel[];
  /** Total que casa com o filtro, sem paginar. */
  total: number;
  page: number;
  limit: number;
};

export interface ListUsersQueryInterface {
  execute(input: ListUsersInput): Promise<ListUsersResult>;
}

export const LIST_USERS_QUERY = Symbol('ListUsersQueryInterface');
