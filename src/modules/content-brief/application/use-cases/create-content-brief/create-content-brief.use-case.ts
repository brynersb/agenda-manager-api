import type { ContentBriefRepositoryInterface } from '@/modules/content-brief/application/interfaces/repositories/content-brief.repository.interface';
import type { RegistryQueryRepositoryInterface } from '@/modules/content-brief/application/interfaces/repositories/registry-query.repository.interface';
import type { ContentBriefDetail } from '@/modules/content-brief/application/queries/find-content-brief-by-id/content-brief-detail';
import type { FindContentBriefByIdQueryInterface } from '@/modules/content-brief/application/queries/find-content-brief-by-id/find-content-brief-by-id.query.interface';
import { toContentBriefData } from '@/modules/content-brief/application/use-cases/common/content-brief-data';
import { validateAssignedRegistries } from '@/modules/content-brief/application/use-cases/common/validate-registries';
import { ContentBriefDomainEntity } from '@/modules/content-brief/domain/entities/content-brief.domain-entity';
import type { ClockInterface } from '@/shared/application/interfaces/clock.interface';
import type { LoggerServiceInterface } from '@/shared/application/interfaces/logger.service.interface';
import type {
  CreateContentBriefInput,
  CreateContentBriefUseCaseInterface,
} from './create-content-brief.use-case.interface';

export class CreateContentBriefUseCase
  implements CreateContentBriefUseCaseInterface
{
  constructor(
    private readonly repository: ContentBriefRepositoryInterface,
    private readonly registryQueryRepository: RegistryQueryRepositoryInterface,
    private readonly findContentBriefById: FindContentBriefByIdQueryInterface,
    private readonly clock: ClockInterface,
    private readonly logger: LoggerServiceInterface,
  ) {
    this.logger.setLogPrefix(CreateContentBriefUseCase.name);
  }

  async execute(input: CreateContentBriefInput): Promise<ContentBriefDetail> {
    const data = toContentBriefData(input);
    // Na criação todo cadastro informado está sendo atribuído agora.
    await validateAssignedRegistries(this.registryQueryRepository, {
      estateDevelopmentId: data.estateDevelopmentId,
      ownerId: data.ownerId,
    });

    const contentBrief = ContentBriefDomainEntity.create(
      data,
      input.actor,
      this.clock.now(),
    );
    await this.repository.create(contentBrief);

    this.logger.info('Pauta criada', {
      'evt.name': 'content_brief.created',
      outcome: 'success',
      content_brief_id: contentBrief.id,
      status: contentBrief.status,
      user_sub: input.actor.id,
      tags: ['content_brief'],
    });

    return this.findContentBriefById.execute({ id: contentBrief.id });
  }
}
