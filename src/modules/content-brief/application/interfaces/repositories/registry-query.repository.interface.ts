/** Situação de um cadastro vista pela pauta. */
export type RegistryStatus = 'active' | 'archived' | 'missing';

/**
 * Pergunta que a pauta faz aos cadastros: "o empreendimento/responsável X
 * existe e está ativo?". Camada anticorrupção: a implementação lê as tabelas
 * dos cadastros por SQL somente leitura, sem importar os módulos deles.
 */
export interface RegistryQueryRepositoryInterface {
  findEstateDevelopmentStatus(id: string): Promise<RegistryStatus>;
  findOwnerStatus(id: string): Promise<RegistryStatus>;
}

export const REGISTRY_QUERY_REPOSITORY = Symbol(
  'RegistryQueryRepositoryInterface',
);
