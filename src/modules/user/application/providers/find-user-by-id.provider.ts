import type { Provider } from '@nestjs/common';

import {
  USER_QUERY_REPOSITORY,
  type UserQueryRepositoryInterface,
} from '@/modules/user/application/interfaces/repositories/user-query.repository.interface';
import { FindUserByIdQuery } from '@/modules/user/application/queries/find-user-by-id/find-user-by-id.query';
import {
  FIND_USER_BY_ID_QUERY,
  type FindUserByIdQueryInterface,
} from '@/modules/user/application/queries/find-user-by-id/find-user-by-id.query.interface';

export const FindUserByIdProvider: Provider = {
  provide: FIND_USER_BY_ID_QUERY,
  inject: [USER_QUERY_REPOSITORY],
  useFactory: (
    queryRepository: UserQueryRepositoryInterface,
  ): FindUserByIdQueryInterface => new FindUserByIdQuery(queryRepository),
};
