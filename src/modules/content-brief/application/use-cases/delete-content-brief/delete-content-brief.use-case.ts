import type { ContentBriefRepositoryInterface } from '@/modules/content-brief/application/interfaces/repositories/content-brief.repository.interface';
import { ContentBriefNotFoundError } from '@/modules/content-brief/domain/errors/content-brief.errors';
import type { ClockInterface } from '@/shared/application/interfaces/clock.interface';
import type { LoggerServiceInterface } from '@/shared/application/interfaces/logger.service.interface';
import type {
  DeleteContentBriefInput,
  DeleteContentBriefUseCaseInterface,
} from './delete-content-brief.use-case.interface';

/**
 * Exclusão lógica: a pauta deixa de ser devolvida (vira `404`) mas continua no
 * banco com quem excluiu e quando. Não exige `version`: excluir não perde a
 * edição de ninguém.
 */
export class DeleteContentBriefUseCase
  implements DeleteContentBriefUseCaseInterface
{
  constructor(
    private readonly repository: ContentBriefRepositoryInterface,
    private readonly clock: ClockInterface,
    private readonly logger: LoggerServiceInterface,
  ) {
    this.logger.setLogPrefix(DeleteContentBriefUseCase.name);
  }

  async execute(input: DeleteContentBriefInput): Promise<void> {
    const contentBrief = await this.repository.findById(input.id);
    if (!contentBrief) {
      throw new ContentBriefNotFoundError();
    }

    contentBrief.delete(input.actor, this.clock.now());
    await this.repository.softDelete(contentBrief);

    this.logger.info('Pauta excluída', {
      'evt.name': 'content_brief.deleted',
      outcome: 'success',
      content_brief_id: contentBrief.id,
      user_sub: input.actor.id,
      tags: ['content_brief'],
    });
  }
}
