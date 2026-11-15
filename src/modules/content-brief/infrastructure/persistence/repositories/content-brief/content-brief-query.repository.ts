import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type {
  ContentBriefCommonFilter,
  ContentBriefCounts,
  ContentBriefListFilter,
  ContentBriefPage,
  ContentBriefQueryRepositoryInterface,
  ContentBriefReadModel,
} from '@/modules/content-brief/application/interfaces/repositories/content-brief-query.repository.interface';
import type { ContentBriefAction } from '@/modules/content-brief/domain/enums/content-brief-action';
import type { ContentBriefChannel } from '@/modules/content-brief/domain/enums/content-brief-channel';
import { ContentBriefStatus } from '@/modules/content-brief/domain/enums/content-brief-status';
import { DueStatus } from '@/modules/content-brief/domain/enums/due-status';
import { ContentBriefEntity } from '@/modules/content-brief/infrastructure/persistence/entities/content-brief.entity';
import {
  buildListWhere,
  buildOrderBy,
  buildSummaryColumns,
  buildSummaryWhere,
  dueStatusAlias,
  REGISTRY_JOINS,
  SqlParams,
  statusAlias,
} from '@/modules/content-brief/infrastructure/persistence/repositories/content-brief/content-brief-filter.sql';
import { CalendarDate } from '@/shared/domain/calendar-date';

type Row = {
  id: string;
  title: string;
  description: string;
  due_date: string | null;
  status: ContentBriefStatus;
  action: ContentBriefAction | null;
  channel: ContentBriefChannel | null;
  estate_development_id: string | null;
  estate_development_name: string | null;
  estate_development_active: boolean | null;
  owner_id: string | null;
  owner_name: string | null;
  owner_active: boolean | null;
  completed_at: Date | null;
  version: number;
  created_at: Date;
  created_by: string;
  created_by_name: string | null;
  updated_at: Date;
  updated_by: string;
  updated_by_name: string | null;
};

/*
 * Os nomes dos cadastros vêm por JOIN de leitura (SQL somente leitura sobre
 * `estate_developments`/`owners`), sem importar os entities desses módulos.
 * `due_date` sai como texto `YYYY-MM-DD` (`to_char`): independe do parser de
 * `date` do driver `pg`, que devolveria `Date` e deslocaria o dia.
 */
const SELECT_CONTENT_BRIEF = `
  SELECT b.id, b.title, b.description,
         to_char(b.due_date, 'YYYY-MM-DD') AS due_date,
         b.status, b.action, b.channel,
         b.estate_development_id, e.name AS estate_development_name,
         e.active AS estate_development_active,
         b.owner_id, o.name AS owner_name,
         o.active AS owner_active,
         b.completed_at, b.version,
         b.created_at, b.created_by, b.created_by_name,
         b.updated_at, b.updated_by, b.updated_by_name
    FROM content_briefs b
    LEFT JOIN estate_developments e ON e.id = b.estate_development_id
    LEFT JOIN owners o ON o.id = b.owner_id`;

@Injectable()
export class ContentBriefQueryRepository
  implements ContentBriefQueryRepositoryInterface
{
  constructor(
    @InjectRepository(ContentBriefEntity)
    private readonly repository: Repository<ContentBriefEntity>,
  ) {}

  async findOneById(id: string): Promise<ContentBriefReadModel | null> {
    const rows: Row[] = await this.repository.query(
      `${SELECT_CONTENT_BRIEF} WHERE b.id = $1 AND b.deleted_at IS NULL`,
      [id],
    );
    return rows[0] ? toReadModel(rows[0]) : null;
  }

  async findAll(filter: ContentBriefListFilter): Promise<ContentBriefPage> {
    const listParams = new SqlParams();
    const listWhere = buildListWhere(listParams, filter);
    const limit = listParams.add(filter.limit);
    const offset = listParams.add((filter.page - 1) * filter.limit);

    const countParams = new SqlParams();
    const countWhere = buildListWhere(countParams, filter);

    // O total é uma consulta à parte (sem `LIMIT`) para continuar correto
    // numa página além da última; as duas rodam em paralelo.
    const [rows, totals]: [Row[], { total: number }[]] = await Promise.all([
      this.repository.query(
        `${SELECT_CONTENT_BRIEF}
          ${listWhere}
          ORDER BY ${buildOrderBy(filter.sort)}
          LIMIT ${limit} OFFSET ${offset}`,
        listParams.values,
      ),
      this.repository.query(
        `SELECT count(*)::int AS total
           FROM content_briefs b${filter.searchTerm ? REGISTRY_JOINS : ''}
          ${countWhere}`,
        countParams.values,
      ),
    ]);
    return { items: rows.map(toReadModel), total: totals[0]?.total ?? 0 };
  }

  async summarize(
    filter: ContentBriefCommonFilter,
  ): Promise<ContentBriefCounts> {
    const params = new SqlParams();
    const columns = buildSummaryColumns(params, filter.today);
    const where = buildSummaryWhere(params, filter);

    const rows: SummaryRow[] = await this.repository.query(
      `SELECT ${columns}
         FROM content_briefs b${filter.searchTerm ? REGISTRY_JOINS : ''}
        ${where}`,
      params.values,
    );
    return toCounts(rows[0]);
  }
}

type SummaryRow = Record<string, number>;

function toCounts(row: SummaryRow | undefined): ContentBriefCounts {
  const count = (alias: string): number => row?.[alias] ?? 0;
  return {
    total: count('total'),
    byDueStatus: Object.fromEntries(
      Object.values(DueStatus).map((dueStatus) => [
        dueStatus,
        count(dueStatusAlias(dueStatus)),
      ]),
    ) as Record<DueStatus, number>,
    byStatus: Object.fromEntries(
      Object.values(ContentBriefStatus).map((status) => [
        status,
        count(statusAlias(status)),
      ]),
    ) as Record<ContentBriefStatus, number>,
  };
}

function toReadModel(row: Row): ContentBriefReadModel {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    dueDate: row.due_date === null ? null : CalendarDate.of(row.due_date),
    status: row.status,
    action: row.action,
    channel: row.channel,
    estateDevelopment:
      row.estate_development_id === null
        ? null
        : {
            id: row.estate_development_id,
            name: row.estate_development_name ?? '',
            active: row.estate_development_active ?? false,
          },
    owner:
      row.owner_id === null
        ? null
        : {
            id: row.owner_id,
            name: row.owner_name ?? '',
            active: row.owner_active ?? false,
          },
    completedAt: row.completed_at,
    version: row.version,
    createdAt: row.created_at,
    createdBy: { id: row.created_by, name: row.created_by_name },
    updatedAt: row.updated_at,
    updatedBy: { id: row.updated_by, name: row.updated_by_name },
  };
}
