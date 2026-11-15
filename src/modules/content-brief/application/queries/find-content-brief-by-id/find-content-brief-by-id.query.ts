import type { ContentBriefQueryRepositoryInterface } from '@/modules/content-brief/application/interfaces/repositories/content-brief-query.repository.interface';
import {
  type ContentBriefDetail,
  withDueStatus,
} from '@/modules/content-brief/application/queries/find-content-brief-by-id/content-brief-detail';
import { ContentBriefNotFoundError } from '@/modules/content-brief/domain/errors/content-brief.errors';
import type { ClockInterface } from '@/shared/application/interfaces/clock.interface';
import type {
  FindContentBriefByIdInput,
  FindContentBriefByIdQueryInterface,
} from './find-content-brief-by-id.query.interface';

/**
 * Detalha uma pauta com a situação do prazo calculada para "hoje". Também é
 * o que os use cases de escrita usam para devolver o resultado gravado.
 */
export class FindContentBriefByIdQuery
  implements FindContentBriefByIdQueryInterface
{
  constructor(
    private readonly queryRepository: ContentBriefQueryRepositoryInterface,
    private readonly clock: ClockInterface,
  ) {}

  async execute(input: FindContentBriefByIdInput): Promise<ContentBriefDetail> {
    const contentBrief = await this.queryRepository.findOneById(input.id);
    if (!contentBrief) {
      throw new ContentBriefNotFoundError();
    }
    return withDueStatus(contentBrief, this.clock.today());
  }
}
