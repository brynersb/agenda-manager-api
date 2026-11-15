import type { EstateDevelopmentReadModel } from '@/modules/estate-development/application/interfaces/repositories/estate-development-query.repository.interface';
import type { Actor } from '@/shared/domain/actor';

export type RenameEstateDevelopmentInput = {
  id: string;
  name: string;
  /** Versão que o cliente leu; divergência vira 409 (ADR-006). */
  version: number;
  actor: Actor;
};

export interface RenameEstateDevelopmentUseCaseInterface {
  execute(
    input: RenameEstateDevelopmentInput,
  ): Promise<EstateDevelopmentReadModel>;
}

export const RENAME_ESTATE_DEVELOPMENT_USE_CASE = Symbol(
  'RenameEstateDevelopmentUseCaseInterface',
);
