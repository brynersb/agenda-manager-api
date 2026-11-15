/** Read model de um responsável, no formato que a API devolve. */
export type OwnerReadModel = {
  id: string;
  name: string;
  email: string | null;
  active: boolean;
  version: number;
  /** Pautas não concluídas que usam o responsável (aviso antes de arquivar). */
  openContentBriefs: number;
};

/** Consultas de leitura (CQRS leve): devolvem read model, não o agregado. */
export interface OwnerQueryRepositoryInterface {
  /** Ordenado por nome com a colação pt-BR, no máximo 500. */
  findAll(filter: { includeArchived: boolean }): Promise<OwnerReadModel[]>;

  findOneById(id: string): Promise<OwnerReadModel | null>;
}

export const OWNER_QUERY_REPOSITORY = Symbol('OwnerQueryRepositoryInterface');
