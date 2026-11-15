import type { EstateDevelopmentReadModel } from '@/modules/estate-development/application/interfaces/repositories/estate-development-query.repository.interface';
import type { Actor } from '@/shared/domain/actor';

export type ReactivateEstateDevelopmentInput = { id: string; actor: Actor };

export interface ReactivateEstateDevelopmentUseCaseInterface {
  execute(
    input: ReactivateEstateDevelopmentInput,
  ): Promise<EstateDevelopmentReadModel>;
}

export const REACTIVATE_ESTATE_DEVELOPMENT_USE_CASE = Symbol(
  'ReactivateEstateDevelopmentUseCaseInterface',
);
