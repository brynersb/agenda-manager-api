import type { Provider } from '@nestjs/common';

import {
  ESTATE_DEVELOPMENT_QUERY_REPOSITORY,
  type EstateDevelopmentQueryRepositoryInterface,
} from '@/modules/estate-development/application/interfaces/repositories/estate-development-query.repository.interface';
import { ListEstateDevelopmentsQuery } from '@/modules/estate-development/application/queries/list-estate-developments/list-estate-developments.query';
import {
  LIST_ESTATE_DEVELOPMENTS_QUERY,
  type ListEstateDevelopmentsQueryInterface,
} from '@/modules/estate-development/application/queries/list-estate-developments/list-estate-developments.query.interface';

export const ListEstateDevelopmentsProvider: Provider = {
  provide: LIST_ESTATE_DEVELOPMENTS_QUERY,
  inject: [ESTATE_DEVELOPMENT_QUERY_REPOSITORY],
  useFactory: (
    queryRepository: EstateDevelopmentQueryRepositoryInterface,
  ): ListEstateDevelopmentsQueryInterface =>
    new ListEstateDevelopmentsQuery(queryRepository),
};
