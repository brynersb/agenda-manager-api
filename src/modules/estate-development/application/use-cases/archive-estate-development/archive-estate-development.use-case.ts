import type { EstateDevelopmentRepositoryInterface } from '@/modules/estate-development/application/interfaces/repositories/estate-development.repository.interface';
import type {
  EstateDevelopmentQueryRepositoryInterface,
  EstateDevelopmentReadModel,
} from '@/modules/estate-development/application/interfaces/repositories/estate-development-query.repository.interface';
import { EstateDevelopmentNotFoundError } from '@/modules/estate-development/domain/errors/estate-development.errors';
import type { ClockInterface } from '@/shared/application/interfaces/clock.interface';
import type { LoggerServiceInterface } from '@/shared/application/interfaces/logger.service.interface';
import type {
  ArchiveEstateDevelopmentInput,
  ArchiveEstateDevelopmentUseCaseInterface,
} from './archive-estate-development.use-case.interface';

/** Idempotente: se o empreendimento já está no estado pedido, nada é gravado. */
export class ArchiveEstateDevelopmentUseCase
  implements ArchiveEstateDevelopmentUseCaseInterface
{
  constructor(
    private readonly repository: EstateDevelopmentRepositoryInterface,
    private readonly queryRepository: EstateDevelopmentQueryRepositoryInterface,
    private readonly clock: ClockInterface,
    private readonly logger: LoggerServiceInterface,
  ) {
    this.logger.setLogPrefix(ArchiveEstateDevelopmentUseCase.name);
  }

  async execute(
    input: ArchiveEstateDevelopmentInput,
  ): Promise<EstateDevelopmentReadModel> {
    const estateDevelopment = await this.repository.findById(input.id);
    if (!estateDevelopment) {
      throw new EstateDevelopmentNotFoundError();
    }

    if (estateDevelopment.active === true) {
      estateDevelopment.archive(input.actor, this.clock.now());
      await this.repository.save(estateDevelopment, estateDevelopment.version);
      this.logger.info('Empreendimento arquivado', {
        'evt.name': 'estate_development.archived',
        outcome: 'success',
        estate_development_id: estateDevelopment.id,
        user_sub: input.actor.id,
        tags: ['estate_development', 'registry'],
      });
    } else {
      this.logger.info('Empreendimento já estava arquivado: nada a fazer', {
        'evt.name': 'estate_development.archived',
        outcome: 'skipped',
        estate_development_id: estateDevelopment.id,
        user_sub: input.actor.id,
        tags: ['estate_development', 'registry'],
      });
    }

    const current = await this.queryRepository.findOneById(
      estateDevelopment.id,
    );
    if (!current) {
      throw new EstateDevelopmentNotFoundError();
    }
    return current;
  }
}
