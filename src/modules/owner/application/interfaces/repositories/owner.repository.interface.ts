import type { OwnerDomainEntity } from '@/modules/owner/domain/entities/owner.domain-entity';

/** Persistência do agregado `OwnerDomainEntity` (escrita e buscas por regra). */
export interface OwnerRepositoryInterface {
  findById(id: string): Promise<OwnerDomainEntity | null>;

  /** Procura entre ativos **e** arquivados: o nome é único nos dois. */
  findByNormalizedName(
    normalizedName: string,
  ): Promise<OwnerDomainEntity | null>;

  /**
   * Sem `expectedVersion` insere; com ela atualiza só se a versão gravada for
   * essa e lança `OwnerVersionOutdatedError` caso contrário.
   * Violação do índice único de nome (corrida) vira
   * `OwnerNameDuplicatedError`.
   */
  save(owner: OwnerDomainEntity, expectedVersion?: number): Promise<void>;
}

export const OWNER_REPOSITORY = Symbol('OwnerRepositoryInterface');
