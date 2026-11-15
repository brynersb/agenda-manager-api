import type { ContentBriefRepositoryInterface } from '@/modules/content-brief/application/interfaces/repositories/content-brief.repository.interface';
import type { RegistryQueryRepositoryInterface } from '@/modules/content-brief/application/interfaces/repositories/registry-query.repository.interface';
import type { ContentBriefDetail } from '@/modules/content-brief/application/queries/find-content-brief-by-id/content-brief-detail';
import type { FindContentBriefByIdQueryInterface } from '@/modules/content-brief/application/queries/find-content-brief-by-id/find-content-brief-by-id.query.interface';
import { toContentBriefData } from '@/modules/content-brief/application/use-cases/common/content-brief-data';
import { recordVersionConflict } from '@/modules/content-brief/application/use-cases/common/record-version-conflict';
import { validateAssignedRegistries } from '@/modules/content-brief/application/use-cases/common/validate-registries';
import {
  ContentBriefNotFoundError,
  ContentBriefVersionOutdatedError,
} from '@/modules/content-brief/domain/errors/content-brief.errors';
import type { ClockInterface } from '@/shared/application/interfaces/clock.interface';
import type { LoggerServiceInterface } from '@/shared/application/interfaces/logger.service.interface';
import type {
  UpdateContentBriefInput,
  UpdateContentBriefUseCaseInterface,
} from './update-content-brief.use-case.interface';

/** Substituição completa dos campos (PUT): campo ausente limpa, não mantém. */
export class UpdateContentBriefUseCase
  implements UpdateContentBriefUseCaseInterface
{
  constructor(
    private readonly repository: ContentBriefRepositoryInterface,
    private readonly registryQueryRepository: RegistryQueryRepositoryInterface,
    private readonly findContentBriefById: FindContentBriefByIdQueryInterface,
    private readonly clock: ClockInterface,
    private readonly logger: LoggerServiceInterface,
  ) {
    this.logger.setLogPrefix(UpdateContentBriefUseCase.name);
  }

  async execute(input: UpdateContentBriefInput): Promise<ContentBriefDetail> {
    const data = toContentBriefData(input);

    const contentBrief = await this.repository.findById(input.id);
    if (!contentBrief) {
      throw new ContentBriefNotFoundError();
    }
    try {
      // Versão velha vem antes da validação de cadastros: o conflito é o
      // problema principal e a pessoa precisa recarregar de qualquer jeito.
      contentBrief.verifyVersion(input.version);

      // Só valida o que está sendo atribuído agora: manter um cadastro que
      // foi arquivado depois da atribuição é permitido.
      await validateAssignedRegistries(this.registryQueryRepository, {
        estateDevelopmentId: contentBrief.estateDevelopmentChanged(
          data.estateDevelopmentId,
        )
          ? data.estateDevelopmentId
          : null,
        ownerId: contentBrief.ownerChanged(data.ownerId) ? data.ownerId : null,
      });

      contentBrief.update(data, input.version, input.actor, this.clock.now());
      await this.repository.update(contentBrief, input.version);
    } catch (error) {
      // Versão velha na leitura ou corrida entre a leitura e o UPDATE.
      if (error instanceof ContentBriefVersionOutdatedError) {
        recordVersionConflict(this.logger, {
          contentBriefId: input.id,
          actor: input.actor,
          operation: 'update',
        });
      }
      throw error;
    }

    this.logger.info('Pauta editada', {
      'evt.name': 'content_brief.updated',
      outcome: 'success',
      content_brief_id: contentBrief.id,
      user_sub: input.actor.id,
      tags: ['content_brief'],
    });

    return this.findContentBriefById.execute({ id: contentBrief.id });
  }
}
