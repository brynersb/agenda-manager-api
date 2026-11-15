import type { Provider } from '@nestjs/common';

import {
  OWNER_QUERY_REPOSITORY,
  type OwnerQueryRepositoryInterface,
} from '@/modules/owner/application/interfaces/repositories/owner-query.repository.interface';
import { ListOwnersQuery } from '@/modules/owner/application/queries/list-owners/list-owners.query';
import {
  LIST_OWNERS_QUERY,
  type ListOwnersQueryInterface,
} from '@/modules/owner/application/queries/list-owners/list-owners.query.interface';

export const ListOwnersProvider: Provider = {
  provide: LIST_OWNERS_QUERY,
  inject: [OWNER_QUERY_REPOSITORY],
  useFactory: (
    queryRepository: OwnerQueryRepositoryInterface,
  ): ListOwnersQueryInterface => new ListOwnersQuery(queryRepository),
};
