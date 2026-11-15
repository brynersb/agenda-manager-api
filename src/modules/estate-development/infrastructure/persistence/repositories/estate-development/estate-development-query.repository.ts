import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type {
  EstateDevelopmentQueryRepositoryInterface,
  EstateDevelopmentReadModel,
} from '@/modules/estate-development/application/interfaces/repositories/estate-development-query.repository.interface';
import { EstateDevelopmentEntity } from '@/modules/estate-development/infrastructure/persistence/entities/estate-development.entity';

/** Limite operacional da lista de cadastros (ADR-010). */
const LIMIT = 500;

type Row = {
  id: string;
  name: string;
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
const COLUMNS = `e.id, e.name, e.active, e.version,
  (SELECT count(*)
     FROM content_briefs cb
    WHERE cb.estate_development_id = e.id
      AND cb.deleted_at IS NULL
      AND cb.status <> 'DONE')::int AS open_content_briefs`;

@Injectable()
export class EstateDevelopmentQueryRepository
  implements EstateDevelopmentQueryRepositoryInterface
{
  constructor(
    @InjectRepository(EstateDevelopmentEntity)
    private readonly repository: Repository<EstateDevelopmentEntity>,
  ) {}

  async findAll(filter: {
    includeArchived: boolean;
  }): Promise<EstateDevelopmentReadModel[]> {
    const rows: Row[] = await this.repository.query(
      `SELECT ${COLUMNS}
         FROM estate_developments e
        WHERE ($1::boolean OR e.active)
        ORDER BY e.name COLLATE "pt_br", e.id
        LIMIT ${LIMIT}`,
      [filter.includeArchived],
    );
    return rows.map(toReadModel);
  }

  async findOneById(id: string): Promise<EstateDevelopmentReadModel | null> {
    const rows: Row[] = await this.repository.query(
      `SELECT ${COLUMNS} FROM estate_developments e WHERE e.id = $1`,
      [id],
    );
    return rows[0] ? toReadModel(rows[0]) : null;
  }
}

function toReadModel(row: Row): EstateDevelopmentReadModel {
  return {
    id: row.id,
    name: row.name,
    active: row.active,
    version: row.version,
    openContentBriefs: row.open_content_briefs,
  };
}
