import type { EstateDevelopmentRepositoryInterface } from '@/modules/estate-development/application/interfaces/repositories/estate-development.repository.interface';
import type {
  EstateDevelopmentQueryRepositoryInterface,
  EstateDevelopmentReadModel,
} from '@/modules/estate-development/application/interfaces/repositories/estate-development-query.repository.interface';
import {
  EstateDevelopmentNameDuplicatedError,
  EstateDevelopmentNotFoundError,
  EstateDevelopmentVersionOutdatedError,
} from '@/modules/estate-development/domain/errors/estate-development.errors';
import type { ClockInterface } from '@/shared/application/interfaces/clock.interface';
import type { LoggerServiceInterface } from '@/shared/application/interfaces/logger.service.interface';
import type { Actor } from '@/shared/domain/actor';
import { RegistryName } from '@/shared/domain/registry-name';
import type {
  RenameEstateDevelopmentInput,
  RenameEstateDevelopmentUseCaseInterface,
} from './rename-estate-development.use-case.interface';

export class RenameEstateDevelopmentUseCase
  implements RenameEstateDevelopmentUseCaseInterface
{
  constructor(
    private readonly repository: EstateDevelopmentRepositoryInterface,
    private readonly queryRepository: EstateDevelopmentQueryRepositoryInterface,
    private readonly clock: ClockInterface,
    private readonly logger: LoggerServiceInterface,
  ) {
    this.logger.setLogPrefix(RenameEstateDevelopmentUseCase.name);
  }

  async execute(
    input: RenameEstateDevelopmentInput,
  ): Promise<EstateDevelopmentReadModel> {
    const name = RegistryName.create(input.name);

    const estateDevelopment = await this.repository.findById(input.id);
    if (!estateDevelopment) {
      throw new EstateDevelopmentNotFoundError();
    }
    if (estateDevelopment.version !== input.version) {
      throw new EstateDevelopmentVersionOutdatedError();
    }

    // Mudar só caixa ou acento do próprio nome ("ipe" -> "Ipê") é permitido:
    // o homônimo encontrado seria ele mesmo.
    const namesake = await this.repository.findByNormalizedName(
      name.normalized,
    );
    if (namesake && namesake.id !== estateDevelopment.id) {
      this.recordNameDuplicated(estateDevelopment.id, input.actor);
      throw new EstateDevelopmentNameDuplicatedError(!namesake.active);
    }

    estateDevelopment.rename(name, input.actor, this.clock.now());
    try {
      await this.repository.save(estateDevelopment, input.version);
    } catch (error) {
      // Corrida: outro pedido ficou com o nome entre a checagem e o update.
      if (error instanceof EstateDevelopmentNameDuplicatedError) {
        this.recordNameDuplicated(estateDevelopment.id, input.actor);
      }
      throw error;
    }

    this.logger.info('Empreendimento renomeado', {
      'evt.name': 'estate_development.renamed',
      outcome: 'success',
      estate_development_id: estateDevelopment.id,
      user_sub: input.actor.id,
      tags: ['estate_development', 'registry'],
    });

    const renamed = await this.queryRepository.findOneById(
      estateDevelopment.id,
    );
    if (!renamed) {
      throw new EstateDevelopmentNotFoundError();
    }
    return renamed;
  }

  private recordNameDuplicated(
    estateDevelopmentId: string,
    actor: Actor,
  ): void {
    this.logger.warn('Renomeação de empreendimento bloqueada: nome já existe', {
      'evt.name': 'estate_development.renamed',
      outcome: 'blocked',
      reason: 'name_duplicated',
      estate_development_id: estateDevelopmentId,
      user_sub: actor.id,
      tags: ['estate_development', 'registry'],
    });
  }
}
