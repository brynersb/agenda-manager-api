import type { EstateDevelopmentDomainEntity } from '@/modules/estate-development/domain/entities/estate-development.domain-entity';

/** Persistência do agregado `EstateDevelopmentDomainEntity` (escrita e buscas por regra). */
export interface EstateDevelopmentRepositoryInterface {
  findById(id: string): Promise<EstateDevelopmentDomainEntity | null>;

  /** Procura entre ativos **e** arquivados: o nome é único nos dois. */
  findByNormalizedName(
    normalizedName: string,
  ): Promise<EstateDevelopmentDomainEntity | null>;

  /**
   * Sem `expectedVersion` insere; com ela atualiza só se a versão gravada for
   * essa e lança `EstateDevelopmentVersionOutdatedError` caso contrário.
   * Violação do índice único de nome (corrida) vira
   * `EstateDevelopmentNameDuplicatedError`.
   */
  save(
    estateDevelopment: EstateDevelopmentDomainEntity,
    expectedVersion?: number,
  ): Promise<void>;
}

export const ESTATE_DEVELOPMENT_REPOSITORY = Symbol(
  'EstateDevelopmentRepositoryInterface',
);
