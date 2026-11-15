import type { Provider } from '@nestjs/common';

import {
  USER_QUERY_REPOSITORY,
  type UserQueryRepositoryInterface,
} from '@/modules/user/application/interfaces/repositories/user-query.repository.interface';
import { ListUsersQuery } from '@/modules/user/application/queries/list-users/list-users.query';
import {
  LIST_USERS_QUERY,
  type ListUsersQueryInterface,
} from '@/modules/user/application/queries/list-users/list-users.query.interface';

export const ListUsersProvider: Provider = {
  provide: LIST_USERS_QUERY,
  inject: [USER_QUERY_REPOSITORY],
  useFactory: (
    queryRepository: UserQueryRepositoryInterface,
  ): ListUsersQueryInterface => new ListUsersQuery(queryRepository),
};
