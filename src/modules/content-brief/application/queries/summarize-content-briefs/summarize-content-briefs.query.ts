import type { ContentBriefQueryRepositoryInterface } from '@/modules/content-brief/application/interfaces/repositories/content-brief-query.repository.interface';
import type { ClockInterface } from '@/shared/application/interfaces/clock.interface';
import type {
  ContentBriefSummary,
  SummarizeContentBriefsInput,
  SummarizeContentBriefsQueryInterface,
} from './summarize-content-briefs.query.interface';

/**
 * Conta as pautas por situação do prazo e por status para os filtros
 * rápidos e as colunas da tela. Não recebe situação do prazo: cada chip
 * mostra quantas pautas teria mesmo com outro selecionado.
 */
export class SummarizeContentBriefsQuery
  implements SummarizeContentBriefsQueryInterface
{
  constructor(
    private readonly queryRepository: ContentBriefQueryRepositoryInterface,
    private readonly clock: ClockInterface,
  ) {}

  async execute(
    input: SummarizeContentBriefsInput,
  ): Promise<ContentBriefSummary> {
    const today = this.clock.today();
    const counts = await this.queryRepository.summarize({
      status: input.status,
      estateDevelopmentId: input.estateDevelopmentId,
      ownerId: input.ownerId,
      action: input.action,
      searchTerm: input.q,
      today,
    });
    return { today, ...counts };
  }
}
