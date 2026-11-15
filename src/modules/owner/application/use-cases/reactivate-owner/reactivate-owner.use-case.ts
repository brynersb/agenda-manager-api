import type { OwnerRepositoryInterface } from '@/modules/owner/application/interfaces/repositories/owner.repository.interface';
import type {
  OwnerQueryRepositoryInterface,
  OwnerReadModel,
} from '@/modules/owner/application/interfaces/repositories/owner-query.repository.interface';
import { OwnerNotFoundError } from '@/modules/owner/domain/errors/owner.errors';
import type { ClockInterface } from '@/shared/application/interfaces/clock.interface';
import type { LoggerServiceInterface } from '@/shared/application/interfaces/logger.service.interface';
import type {
  ReactivateOwnerInput,
  ReactivateOwnerUseCaseInterface,
} from './reactivate-owner.use-case.interface';

/** Idempotente: se o responsável já está no estado pedido, nada é gravado. */
export class ReactivateOwnerUseCase implements ReactivateOwnerUseCaseInterface {
  constructor(
    private readonly repository: OwnerRepositoryInterface,
    private readonly queryRepository: OwnerQueryRepositoryInterface,
    private readonly clock: ClockInterface,
    private readonly logger: LoggerServiceInterface,
  ) {
    this.logger.setLogPrefix(ReactivateOwnerUseCase.name);
  }

  async execute(input: ReactivateOwnerInput): Promise<OwnerReadModel> {
    const owner = await this.repository.findById(input.id);
    if (!owner) {
      throw new OwnerNotFoundError();
    }

    if (owner.active === false) {
      owner.reactivate(input.actor, this.clock.now());
      await this.repository.save(owner, owner.version);
      this.logger.info('Responsável reativado', {
        'evt.name': 'owner.reactivated',
        outcome: 'success',
        owner_id: owner.id,
        user_sub: input.actor.id,
        tags: ['owner', 'registry'],
      });
    } else {
      this.logger.info('Responsável já estava reativado: nada a fazer', {
        'evt.name': 'owner.reactivated',
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
