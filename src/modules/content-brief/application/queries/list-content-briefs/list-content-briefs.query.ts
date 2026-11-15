import type { ContentBriefQueryRepositoryInterface } from '@/modules/content-brief/application/interfaces/repositories/content-brief-query.repository.interface';
import { withDueStatus } from '@/modules/content-brief/application/queries/find-content-brief-by-id/content-brief-detail';
import type { ClockInterface } from '@/shared/application/interfaces/clock.interface';
import type {
  ListContentBriefsInput,
  ListContentBriefsQueryInterface,
  ListContentBriefsResult,
} from './list-content-briefs.query.interface';

/**
 * Lista as pautas de uma página com a situação do prazo calculada para
 * "hoje". O filtro de situação é traduzido para datas em SQL com o mesmo
 * "hoje" usado para classificar cada item, então lista e resposta concordam.
 */
export class ListContentBriefsQuery implements ListContentBriefsQueryInterface {
  constructor(
    private readonly queryRepository: ContentBriefQueryRepositoryInterface,
    private readonly clock: ClockInterface,
  ) {}

  async execute(
    input: ListContentBriefsInput,
  ): Promise<ListContentBriefsResult> {
    const today = this.clock.today();
    const { items, total } = await this.queryRepository.findAll({
      dueStatus: input.dueStatus,
      status: input.status,
      estateDevelopmentId: input.estateDevelopmentId,
      ownerId: input.ownerId,
      action: input.action,
      searchTerm: input.q,
      sort: input.sort,
      page: input.page,
      limit: input.limit,
      today,
    });
    return {
      data: items.map((item) => withDueStatus(item, today)),
      total,
      page: input.page,
      limit: input.limit,
    };
  }
}
