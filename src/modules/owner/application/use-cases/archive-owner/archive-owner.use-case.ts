import type { OwnerRepositoryInterface } from '@/modules/owner/application/interfaces/repositories/owner.repository.interface';
import type {
  OwnerQueryRepositoryInterface,
  OwnerReadModel,
} from '@/modules/owner/application/interfaces/repositories/owner-query.repository.interface';
import { OwnerNotFoundError } from '@/modules/owner/domain/errors/owner.errors';
import type { ClockInterface } from '@/shared/application/interfaces/clock.interface';
import type { LoggerServiceInterface } from '@/shared/application/interfaces/logger.service.interface';
import type {
  ArchiveOwnerInput,
  ArchiveOwnerUseCaseInterface,
} from './archive-owner.use-case.interface';

/** Idempotente: se o responsável já está no estado pedido, nada é gravado. */
export class ArchiveOwnerUseCase implements ArchiveOwnerUseCaseInterface {
  constructor(
    private readonly repository: OwnerRepositoryInterface,
    private readonly queryRepository: OwnerQueryRepositoryInterface,
    private readonly clock: ClockInterface,
    private readonly logger: LoggerServiceInterface,
  ) {
    this.logger.setLogPrefix(ArchiveOwnerUseCase.name);
  }

  async execute(input: ArchiveOwnerInput): Promise<OwnerReadModel> {
    const owner = await this.repository.findById(input.id);
    if (!owner) {
      throw new OwnerNotFoundError();
    }

    if (owner.active === true) {
      owner.archive(input.actor, this.clock.now());
      await this.repository.save(owner, owner.version);
      this.logger.info('Responsável arquivado', {
        'evt.name': 'owner.archived',
        outcome: 'success',
        owner_id: owner.id,
        user_sub: input.actor.id,
        tags: ['owner', 'registry'],
      });
    } else {
      this.logger.info('Responsável já estava arquivado: nada a fazer', {
        'evt.name': 'owner.archived',
        outcome: 'skipped',
        owner_id: owner.id,
        user_sub: input.actor.id,
        tags: ['owner', 'registry'],
      });
    }

    const current = await this.queryRepository.findOneById(owner.id);
    if (!current) {
      throw new OwnerNotFoundError();
    }
    return current;
  }
}
