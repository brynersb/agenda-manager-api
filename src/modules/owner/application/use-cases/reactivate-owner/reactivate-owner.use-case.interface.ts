import type { OwnerReadModel } from '@/modules/owner/application/interfaces/repositories/owner-query.repository.interface';
import type { Actor } from '@/shared/domain/actor';

export type ReactivateOwnerInput = { id: string; actor: Actor };

export interface ReactivateOwnerUseCaseInterface {
  execute(input: ReactivateOwnerInput): Promise<OwnerReadModel>;
}

export const REACTIVATE_OWNER_USE_CASE = Symbol(
  'ReactivateOwnerUseCaseInterface',
);
