import type {
  EstateDevelopmentQueryRepositoryInterface,
  EstateDevelopmentReadModel,
} from '@/modules/estate-development/application/interfaces/repositories/estate-development-query.repository.interface';
import type {
  ListEstateDevelopmentsInput,
  ListEstateDevelopmentsQueryInterface,
} from './list-estate-developments.query.interface';

/** Lista os empreendimentos por nome (pt-BR); arquivados só se pedidos. */
export class ListEstateDevelopmentsQuery
  implements ListEstateDevelopmentsQueryInterface
{
  constructor(
    private readonly queryRepository: EstateDevelopmentQueryRepositoryInterface,
  ) {}

  execute(
    input: ListEstateDevelopmentsInput,
  ): Promise<EstateDevelopmentReadModel[]> {
    return this.queryRepository.findAll({
      includeArchived: input.includeArchived,
    });
  }
}
