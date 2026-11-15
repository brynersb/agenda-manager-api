import type {
  OwnerQueryRepositoryInterface,
  OwnerReadModel,
} from '@/modules/owner/application/interfaces/repositories/owner-query.repository.interface';
import type {
  ListOwnersInput,
  ListOwnersQueryInterface,
} from './list-owners.query.interface';

/** Lista os responsáveis por nome (pt-BR); arquivados só se pedidos. */
export class ListOwnersQuery implements ListOwnersQueryInterface {
  constructor(
    private readonly queryRepository: OwnerQueryRepositoryInterface,
  ) {}

  execute(input: ListOwnersInput): Promise<OwnerReadModel[]> {
    return this.queryRepository.findAll({
      includeArchived: input.includeArchived,
    });
  }
}
