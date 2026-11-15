import type { OwnerRepositoryInterface } from '@/modules/owner/application/interfaces/repositories/owner.repository.interface';
import type {
  OwnerQueryRepositoryInterface,
  OwnerReadModel,
} from '@/modules/owner/application/interfaces/repositories/owner-query.repository.interface';
import {
  OwnerNameDuplicatedError,
  OwnerNotFoundError,
  OwnerVersionOutdatedError,
} from '@/modules/owner/domain/errors/owner.errors';
import { Email } from '@/modules/owner/domain/value-objects/email';
import type { ClockInterface } from '@/shared/application/interfaces/clock.interface';
import type { LoggerServiceInterface } from '@/shared/application/interfaces/logger.service.interface';
import type { Actor } from '@/shared/domain/actor';
import { RegistryName } from '@/shared/domain/registry-name';
import type {
  RenameOwnerInput,
  RenameOwnerUseCaseInterface,
} from './rename-owner.use-case.interface';

export class RenameOwnerUseCase implements RenameOwnerUseCaseInterface {
  constructor(
    private readonly repository: OwnerRepositoryInterface,
    private readonly queryRepository: OwnerQueryRepositoryInterface,
    private readonly clock: ClockInterface,
    private readonly logger: LoggerServiceInterface,
  ) {
    this.logger.setLogPrefix(RenameOwnerUseCase.name);
  }

  async execute(input: RenameOwnerInput): Promise<OwnerReadModel> {
    const name = RegistryName.create(input.name);
    const email =
      input.email === undefined ? undefined : Email.createOrNull(input.email);

    const owner = await this.repository.findById(input.id);
    if (!owner) {
      throw new OwnerNotFoundError();
    }
    if (owner.version !== input.version) {
      throw new OwnerVersionOutdatedError();
    }

    // Mudar só caixa ou acento do próprio nome ("ipe" -> "Ipê") é permitido:
    // o homônimo encontrado seria ele mesmo.
    const namesake = await this.repository.findByNormalizedName(
      name.normalized,
    );
    if (namesake && namesake.id !== owner.id) {
      this.recordNameDuplicated(owner.id, input.actor);
      throw new OwnerNameDuplicatedError(!namesake.active);
    }

    const now = this.clock.now();
    owner.rename(name, input.actor, now);
    if (email !== undefined) {
      owner.changeEmail(email, input.actor, now);
    }
    try {
      await this.repository.save(owner, input.version);
    } catch (error) {
      // Corrida: outro pedido ficou com o nome entre a checagem e o update.
      if (error instanceof OwnerNameDuplicatedError) {
        this.recordNameDuplicated(owner.id, input.actor);
      }
      throw error;
    }

    this.logger.info('Responsável renomeado', {
      'evt.name': 'owner.renamed',
      outcome: 'success',
      owner_id: owner.id,
      user_sub: input.actor.id,
      tags: ['owner', 'registry'],
    });

    const renamed = await this.queryRepository.findOneById(owner.id);
    if (!renamed) {
      throw new OwnerNotFoundError();
    }
    return renamed;
  }

  private recordNameDuplicated(ownerId: string, actor: Actor): void {
    this.logger.warn('Renomeação de responsável bloqueada: nome já existe', {
      'evt.name': 'owner.renamed',
      outcome: 'blocked',
      reason: 'name_duplicated',
      owner_id: ownerId,
      user_sub: actor.id,
      tags: ['owner', 'registry'],
    });
  }
}
