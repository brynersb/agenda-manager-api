import type { OwnerRepositoryInterface } from '@/modules/owner/application/interfaces/repositories/owner.repository.interface';
import type {
  OwnerQueryRepositoryInterface,
  OwnerReadModel,
} from '@/modules/owner/application/interfaces/repositories/owner-query.repository.interface';
import { OwnerDomainEntity } from '@/modules/owner/domain/entities/owner.domain-entity';
import {
  OwnerNameDuplicatedError,
  OwnerNotFoundError,
} from '@/modules/owner/domain/errors/owner.errors';
import { Email } from '@/modules/owner/domain/value-objects/email';
import type { ClockInterface } from '@/shared/application/interfaces/clock.interface';
import type { LoggerServiceInterface } from '@/shared/application/interfaces/logger.service.interface';
import type { Actor } from '@/shared/domain/actor';
import { RegistryName } from '@/shared/domain/registry-name';
import type {
  CreateOwnerInput,
  CreateOwnerUseCaseInterface,
} from './create-owner.use-case.interface';

export class CreateOwnerUseCase implements CreateOwnerUseCaseInterface {
  constructor(
    private readonly repository: OwnerRepositoryInterface,
    private readonly queryRepository: OwnerQueryRepositoryInterface,
    private readonly clock: ClockInterface,
    private readonly logger: LoggerServiceInterface,
  ) {
    this.logger.setLogPrefix(CreateOwnerUseCase.name);
  }

  async execute(input: CreateOwnerInput): Promise<OwnerReadModel> {
    const name = RegistryName.create(input.name);
    const email = Email.createOrNull(input.email);

    const namesake = await this.repository.findByNormalizedName(
      name.normalized,
    );
    if (namesake) {
      this.recordNameDuplicated(input.actor);
      throw new OwnerNameDuplicatedError(!namesake.active);
    }

    const owner = OwnerDomainEntity.create(
      { name, email },
      input.actor,
      this.clock.now(),
    );
    try {
      await this.repository.save(owner);
    } catch (error) {
      // Corrida: outro pedido gravou o mesmo nome entre a checagem e o insert.
      if (error instanceof OwnerNameDuplicatedError) {
        this.recordNameDuplicated(input.actor);
      }
      throw error;
    }

    this.logger.info('Responsável criado', {
      'evt.name': 'owner.created',
      outcome: 'success',
      owner_id: owner.id,
      user_sub: input.actor.id,
      tags: ['owner', 'registry'],
    });

    const created = await this.queryRepository.findOneById(owner.id);
    if (!created) {
      throw new OwnerNotFoundError();
    }
    return created;
  }

  private recordNameDuplicated(actor: Actor): void {
    this.logger.warn('Criação de responsável bloqueada: nome já existe', {
      'evt.name': 'owner.created',
      outcome: 'blocked',
      reason: 'name_duplicated',
      user_sub: actor.id,
      tags: ['owner', 'registry'],
    });
  }
}
