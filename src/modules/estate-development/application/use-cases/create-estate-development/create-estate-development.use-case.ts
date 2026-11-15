import type { EstateDevelopmentRepositoryInterface } from '@/modules/estate-development/application/interfaces/repositories/estate-development.repository.interface';
import type {
  EstateDevelopmentQueryRepositoryInterface,
  EstateDevelopmentReadModel,
} from '@/modules/estate-development/application/interfaces/repositories/estate-development-query.repository.interface';
import { EstateDevelopmentDomainEntity } from '@/modules/estate-development/domain/entities/estate-development.domain-entity';
import {
  EstateDevelopmentNameDuplicatedError,
  EstateDevelopmentNotFoundError,
} from '@/modules/estate-development/domain/errors/estate-development.errors';
import type { ClockInterface } from '@/shared/application/interfaces/clock.interface';
import type { LoggerServiceInterface } from '@/shared/application/interfaces/logger.service.interface';
import type { Actor } from '@/shared/domain/actor';
import { RegistryName } from '@/shared/domain/registry-name';
import type {
  CreateEstateDevelopmentInput,
  CreateEstateDevelopmentUseCaseInterface,
} from './create-estate-development.use-case.interface';

export class CreateEstateDevelopmentUseCase
  implements CreateEstateDevelopmentUseCaseInterface
{
  constructor(
    private readonly repository: EstateDevelopmentRepositoryInterface,
    private readonly queryRepository: EstateDevelopmentQueryRepositoryInterface,
    private readonly clock: ClockInterface,
    private readonly logger: LoggerServiceInterface,
  ) {
    this.logger.setLogPrefix(CreateEstateDevelopmentUseCase.name);
  }

  async execute(
    input: CreateEstateDevelopmentInput,
  ): Promise<EstateDevelopmentReadModel> {
    const name = RegistryName.create(input.name);

    const namesake = await this.repository.findByNormalizedName(
      name.normalized,
    );
    if (namesake) {
      this.recordNameDuplicated(input.actor);
      throw new EstateDevelopmentNameDuplicatedError(!namesake.active);
    }

    const estateDevelopment = EstateDevelopmentDomainEntity.create(
      { name },
      input.actor,
      this.clock.now(),
    );
    try {
      await this.repository.save(estateDevelopment);
    } catch (error) {
      // Corrida: outro pedido gravou o mesmo nome entre a checagem e o insert.
      if (error instanceof EstateDevelopmentNameDuplicatedError) {
        this.recordNameDuplicated(input.actor);
      }
      throw error;
    }

    this.logger.info('Empreendimento criado', {
      'evt.name': 'estate_development.created',
      outcome: 'success',
      estate_development_id: estateDevelopment.id,
      user_sub: input.actor.id,
      tags: ['estate_development', 'registry'],
    });

    const created = await this.queryRepository.findOneById(
      estateDevelopment.id,
    );
    if (!created) {
      throw new EstateDevelopmentNotFoundError();
    }
    return created;
  }

  private recordNameDuplicated(actor: Actor): void {
    this.logger.warn('Criação de empreendimento bloqueada: nome já existe', {
      'evt.name': 'estate_development.created',
      outcome: 'blocked',
      reason: 'name_duplicated',
      user_sub: actor.id,
      tags: ['estate_development', 'registry'],
    });
  }
}
