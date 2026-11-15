import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type {
  OwnerQueryRepositoryInterface,
  OwnerReadModel,
} from '@/modules/owner/application/interfaces/repositories/owner-query.repository.interface';
import { OwnerEntity } from '@/modules/owner/infrastructure/persistence/entities/owner.entity';

/** Limite operacional da lista de cadastros (ADR-010). */
const LIMIT = 500;

type Row = {
  id: string;
  name: string;
  email: string | null;
  active: boolean;
  version: number;
  open_content_briefs: number;
};

/*
 * `open_content_briefs`: pautas não excluídas e não concluídas que usam o
 * cadastro (aviso antes de arquivar). Subconsulta correlacionada sobre
 * `content_briefs`, só leitura, sem importar o módulo de pautas; o filtro no
 * `WHERE` casa com o predicado dos índices parciais `ix_content_briefs_*`. O
 * `::int` é obrigatório: `count(*)` é `bigint` e o `pg` o devolveria como texto.
 */
const COLUMNS = `r.id, r.name, r.email, r.active, r.version,
  (SELECT count(*)
     FROM content_briefs cb
    WHERE cb.owner_id = r.id
      AND cb.deleted_at IS NULL
      AND cb.status <> 'DONE')::int AS open_content_briefs`;

@Injectable()
export class OwnerQueryRepository implements OwnerQueryRepositoryInterface {
  constructor(
    @InjectRepository(OwnerEntity)
    private readonly repository: Repository<OwnerEntity>,
  ) {}

  async findAll(filter: {
    includeArchived: boolean;
  }): Promise<OwnerReadModel[]> {
    const rows: Row[] = await this.repository.query(
      `SELECT ${COLUMNS}
         FROM owners r
        WHERE ($1::boolean OR r.active)
        ORDER BY r.name COLLATE "pt_br", r.id
        LIMIT ${LIMIT}`,
      [filter.includeArchived],
    );
    return rows.map(toReadModel);
  }

  async findOneById(id: string): Promise<OwnerReadModel | null> {
    const rows: Row[] = await this.repository.query(
      `SELECT ${COLUMNS} FROM owners r WHERE r.id = $1`,
      [id],
    );
    return rows[0] ? toReadModel(rows[0]) : null;
  }
}

function toReadModel(row: Row): OwnerReadModel {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    active: row.active,
    version: row.version,
    openContentBriefs: row.open_content_briefs,
  };
}
