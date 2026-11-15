import type { EstateDevelopmentReadModel } from '@/modules/estate-development/application/interfaces/repositories/estate-development-query.repository.interface';
import type { Actor } from '@/shared/domain/actor';

export type CreateEstateDevelopmentInput = { name: string; actor: Actor };

export interface CreateEstateDevelopmentUseCaseInterface {
  execute(
    input: CreateEstateDevelopmentInput,
  ): Promise<EstateDevelopmentReadModel>;
}

export const CREATE_ESTATE_DEVELOPMENT_USE_CASE = Symbol(
  'CreateEstateDevelopmentUseCaseInterface',
);
