import type { OwnerReadModel } from '@/modules/owner/application/interfaces/repositories/owner-query.repository.interface';

export type ListOwnersInput = { includeArchived: boolean };

export interface ListOwnersQueryInterface {
  execute(input: ListOwnersInput): Promise<OwnerReadModel[]>;
}

export const LIST_OWNERS_QUERY = Symbol('ListOwnersQueryInterface');
