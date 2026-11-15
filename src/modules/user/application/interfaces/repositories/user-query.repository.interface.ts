import type { Role } from '@/modules/auth/domain/enums/role';
import type { UserStatus } from '@/modules/user/domain/enums/user-status';

/** Read model de um usuário, no formato que a API devolve. Nunca carrega o hash da senha. */
export type UserReadModel = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  mustChangePassword: boolean;
  /** Fim do bloqueio por tentativas; só vale se ainda está no futuro. */
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  version: number;
  createdAt: Date;
  createdBy: { id: string; name: string | null };
  updatedAt: Date;
  updatedBy: { id: string; name: string | null };
};

export type UserListFilter = {
  /** Busca por nome ou e-mail, sem caixa e sem acento. */
  searchTerm?: string;
  status?: UserStatus;
  page: number;
  limit: number;
};

export type UserPage = { items: UserReadModel[]; total: number };

/** Consultas de leitura (CQRS leve): devolvem read model, não o agregado. */
export interface UserQueryRepositoryInterface {
  /** Ordenado por nome (colação pt-BR) e id. */
  findAll(filter: UserListFilter): Promise<UserPage>;

  findOneById(id: string): Promise<UserReadModel | null>;
}

export const USER_QUERY_REPOSITORY = Symbol('UserQueryRepositoryInterface');
