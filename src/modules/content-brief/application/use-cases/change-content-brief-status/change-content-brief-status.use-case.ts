import type { ContentBriefRepositoryInterface } from '@/modules/content-brief/application/interfaces/repositories/content-brief.repository.interface';
import type { ContentBriefDetail } from '@/modules/content-brief/application/queries/find-content-brief-by-id/content-brief-detail';
import type { FindContentBriefByIdQueryInterface } from '@/modules/content-brief/application/queries/find-content-brief-by-id/find-content-brief-by-id.query.interface';
import { recordVersionConflict } from '@/modules/content-brief/application/use-cases/common/record-version-conflict';
import {
  ContentBriefNotFoundError,
  ContentBriefVersionOutdatedError,
} from '@/modules/content-brief/domain/errors/content-brief.errors';
import type { ClockInterface } from '@/shared/application/interfaces/clock.interface';
import type { LoggerServiceInterface } from '@/shared/application/interfaces/logger.service.interface';
import type {
  ChangeContentBriefStatusInput,
  ChangeContentBriefStatusUseCaseInterface,
} from './change-content-brief-status.use-case.interface';

/**
 * Troca só o status. Não valida empreendimento nem responsável: a pauta
 * mantém os que já tinha, mesmo arquivados.
 */
export class ChangeContentBriefStatusUseCase
  implements ChangeContentBriefStatusUseCaseInterface
{
  constructor(
    private readonly repository: ContentBriefRepositoryInterface,
    private readonly findContentBriefById: FindContentBriefByIdQueryInterface,
    private readonly clock: ClockInterface,
    private readonly logger: LoggerServiceInterface,
  ) {
    this.logger.setLogPrefix(ChangeContentBriefStatusUseCase.name);
  }

  async execute(
    input: ChangeContentBriefStatusInput,
  ): Promise<ContentBriefDetail> {
    const contentBrief = await this.repository.findById(input.id);
    if (!contentBrief) {
      throw new ContentBriefNotFoundError();
    }
    const previousStatus = contentBrief.status;

    try {
      contentBrief.changeStatus(
        input.status,
        input.version,
        input.actor,
        this.clock.now(),
      );
      await this.repository.update(contentBrief, input.version);
    } catch (error) {
      // Versão velha na leitura ou corrida entre a leitura e o UPDATE.
      if (error instanceof ContentBriefVersionOutdatedError) {
        recordVersionConflict(this.logger, {
          contentBriefId: input.id,
          actor: input.actor,
          operation: 'change_status',
        });
      }
      throw error;
    }

    this.logger.info('Status da pauta alterado', {
      'evt.name': 'content_brief.status_changed',
      outcome: 'success',
      content_brief_id: contentBrief.id,
      previous_status: previousStatus,
      new_status: contentBrief.status,
      user_sub: input.actor.id,
      tags: ['content_brief'],
    });

    return this.findContentBriefById.execute({ id: contentBrief.id });
  }
}
