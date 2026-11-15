import type { EstateDevelopmentReadModel } from '@/modules/estate-development/application/interfaces/repositories/estate-development-query.repository.interface';

export type ListEstateDevelopmentsInput = { includeArchived: boolean };

export interface ListEstateDevelopmentsQueryInterface {
  execute(
    input: ListEstateDevelopmentsInput,
  ): Promise<EstateDevelopmentReadModel[]>;
}

export const LIST_ESTATE_DEVELOPMENTS_QUERY = Symbol(
  'ListEstateDevelopmentsQueryInterface',
);
