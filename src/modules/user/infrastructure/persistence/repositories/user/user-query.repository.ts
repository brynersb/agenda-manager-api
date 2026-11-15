import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { Role } from '@/modules/auth/domain/enums/role';
import type {
  UserListFilter,
  UserPage,
  UserQueryRepositoryInterface,
  UserReadModel,
} from '@/modules/user/application/interfaces/repositories/user-query.repository.interface';
import type { UserStatus } from '@/modules/user/domain/enums/user-status';
import { UserEntity } from '@/modules/user/infrastructure/persistence/entities/user.entity';

type Row = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  must_change_password: boolean;
  locked_until: Date | null;
  last_login_at: Date | null;
  version: number;
  created_at: Date;
  created_by: string;
  created_by_name: string | null;
  updated_at: Date;
  updated_by: string;
  updated_by_name: string | null;
};

/** Só colunas públicas: `password_hash` e o contador de falhas nunca saem daqui. */
const COLUMNS = `u.id, u.name, u.email, u.role, u.status, u.must_change_password,
  u.locked_until, u.last_login_at, u.version,
  u.created_at, u.created_by, u.created_by_name,
  u.updated_at, u.updated_by, u.updated_by_name`;

/**
 * Escapa `\`, `%` e `_` para o texto digitado valer como literal num `LIKE`
 * com `ESCAPE '\'`: `100%` não pode virar curinga.
 */
function escapeLikePattern(text: string): string {
  return text.replace(/[\\%_]/g, '\\$&');
}

/**
 * Filtros com parâmetros fixos (`$1` busca, `$2` situação): o valor do usuário
 * entra só como parâmetro, nunca interpolado. A busca ignora caixa e acento
 * (`immutable_unaccent`, migration `CreateExtensionsAndCollation`).
 */
const WHERE = `
  WHERE ($1::text IS NULL
         OR lower(immutable_unaccent(concat_ws(' ', u.name, u.email)))
            LIKE lower(immutable_unaccent($1)) ESCAPE '\\')
    AND ($2::user_status IS NULL OR u.status = $2::user_status)`;

@Injectable()
export class UserQueryRepository implements UserQueryRepositoryInterface {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repository: Repository<UserEntity>,
  ) {}

  async findAll(filter: UserListFilter): Promise<UserPage> {
    const pattern =
      filter.searchTerm === undefined
        ? null
        : `%${escapeLikePattern(filter.searchTerm)}%`;
    const status = filter.status ?? null;

    const [rows, totals]: [Row[], { total: number }[]] = await Promise.all([
      this.repository.query(
        `SELECT ${COLUMNS}
           FROM users u
          ${WHERE}
          ORDER BY u.name COLLATE "pt_br", u.id
          LIMIT $3 OFFSET $4`,
        [pattern, status, filter.limit, (filter.page - 1) * filter.limit],
      ),
      this.repository.query(
        `SELECT count(*)::int AS total FROM users u ${WHERE}`,
        [pattern, status],
      ),
    ]);
    return { items: rows.map(toReadModel), total: totals[0]?.total ?? 0 };
  }

  async findOneById(id: string): Promise<UserReadModel | null> {
    const rows: Row[] = await this.repository.query(
      `SELECT ${COLUMNS} FROM users u WHERE u.id = $1`,
      [id],
    );
    return rows[0] ? toReadModel(rows[0]) : null;
  }
}

function toReadModel(row: Row): UserReadModel {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    mustChangePassword: row.must_change_password,
    lockedUntil: row.locked_until,
    lastLoginAt: row.last_login_at,
    version: row.version,
    createdAt: row.created_at,
    createdBy: { id: row.created_by, name: row.created_by_name },
    updatedAt: row.updated_at,
    updatedBy: { id: row.updated_by, name: row.updated_by_name },
  };
}
