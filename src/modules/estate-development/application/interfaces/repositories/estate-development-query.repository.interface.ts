/** Read model de um empreendimento, no formato que a API devolve. */
export type EstateDevelopmentReadModel = {
  id: string;
  name: string;
  active: boolean;
  version: number;
  /** Pautas não concluídas que usam o empreendimento (aviso antes de arquivar). */
  openContentBriefs: number;
};

/** Consultas de leitura (CQRS leve): devolvem read model, não o agregado. */
export interface EstateDevelopmentQueryRepositoryInterface {
  /** Ordenado por nome com a colação pt-BR, no máximo 500. */
  findAll(filter: {
    includeArchived: boolean;
  }): Promise<EstateDevelopmentReadModel[]>;

  findOneById(id: string): Promise<EstateDevelopmentReadModel | null>;
}

export const ESTATE_DEVELOPMENT_QUERY_REPOSITORY = Symbol(
  'EstateDevelopmentQueryRepositoryInterface',
);
