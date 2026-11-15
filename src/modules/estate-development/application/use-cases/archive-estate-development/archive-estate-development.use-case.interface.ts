import type { EstateDevelopmentReadModel } from '@/modules/estate-development/application/interfaces/repositories/estate-development-query.repository.interface';
import type { Actor } from '@/shared/domain/actor';

export type ArchiveEstateDevelopmentInput = { id: string; actor: Actor };

export interface ArchiveEstateDevelopmentUseCaseInterface {
  execute(
    input: ArchiveEstateDevelopmentInput,
  ): Promise<EstateDevelopmentReadModel>;
}

export const ARCHIVE_ESTATE_DEVELOPMENT_USE_CASE = Symbol(
  'ArchiveEstateDevelopmentUseCaseInterface',
);
