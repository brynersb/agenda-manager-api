import {
  type ContentBriefCommonFilter,
  type ContentBriefListFilter,
  NO_REGISTRY,
} from '@/modules/content-brief/application/interfaces/repositories/content-brief-query.repository.interface';
import { ACTION_LABEL } from '@/modules/content-brief/domain/enums/content-brief-action';
import { CHANNEL_LABEL } from '@/modules/content-brief/domain/enums/content-brief-channel';
import { ContentBriefSort } from '@/modules/content-brief/domain/enums/content-brief-sort';
import { ContentBriefStatus } from '@/modules/content-brief/domain/enums/content-brief-status';
import { DueStatus } from '@/modules/content-brief/domain/enums/due-status';
import { NEXT_DAYS_WINDOW } from '@/modules/content-brief/domain/services/classify-due-date';
import type { CalendarDate } from '@/shared/domain/calendar-date';

/*
 * Montagem dos predicados SQL da listagem e do resumo. Tudo aqui é função
 * pura: devolve texto SQL com `$n` e a lista de valores, sem tocar o banco
 * (por isso é testável em spec). Valor vindo do usuário só entra como
 * parâmetro; o único texto interpolado são constantes do código (nomes de
 * coluna, valores de enum, direção da ordenação).
 *
 * O alias `b` é `content_briefs`, `e` é `estate_developments` e `o` é
 * `owners`.
 */

/** Junções de leitura que trazem os nomes dos cadastros. */
export const REGISTRY_JOINS = `
    LEFT JOIN estate_developments e ON e.id = b.estate_development_id
    LEFT JOIN owners o ON o.id = b.owner_id`;

/** Acumula os valores de um comando e devolve o `$n` de cada um. */
export class SqlParams {
  readonly values: unknown[] = [];

  /** Registra `value` e devolve o marcador posicional dele. */
  add(value: unknown): string {
    this.values.push(value);
    return `$${this.values.length}`;
  }
}

const OPEN = `b.status <> '${ContentBriefStatus.DONE}'`;

/**
 * Escapa `\`, `%` e `_` para o texto digitado valer como literal num `LIKE`
 * com `ESCAPE '\'`: `100%` não pode virar curinga.
 */
export function escapeLikePattern(text: string): string {
  return text.replace(/[\\%_]/g, '\\$&');
}

/**
 * Devolve o predicado SQL de cada situação do prazo em relação a `today`
 * (tabela do ADR-005, espelho de `classifyDueDate`). Os parâmetros de data
 * são registrados só quando um predicado que os usa é pedido: o Postgres
 * recusa parâmetro declarado e não referenciado.
 */
export function createDueStatusPredicates(
  params: SqlParams,
  today: CalendarDate,
): (dueStatus: DueStatus) => string {
  let todayRef: string | undefined;
  let limitRef: string | undefined;
  const todaySql = (): string => {
    todayRef ??= `${params.add(today.toString())}::date`;
    return todayRef;
  };
  const limitSql = (): string => {
    limitRef ??= `${params.add(today.addDays(NEXT_DAYS_WINDOW).toString())}::date`;
    return limitRef;
  };

  return (dueStatus) => {
    switch (dueStatus) {
      case DueStatus.OVERDUE:
        return `(${OPEN} AND b.due_date < ${todaySql()})`;
      case DueStatus.TODAY:
        return `(${OPEN} AND b.due_date = ${todaySql()})`;
      case DueStatus.NEXT_7_DAYS:
        return `(${OPEN} AND b.due_date > ${todaySql()} AND b.due_date <= ${limitSql()})`;
      case DueStatus.LATER:
        return `(${OPEN} AND b.due_date > ${limitSql()})`;
      case DueStatus.NO_DUE_DATE:
        return `(${OPEN} AND b.due_date IS NULL)`;
      case DueStatus.COMPLETED:
        return `b.status = '${ContentBriefStatus.DONE}'`;
    }
  };
}

/**
 * Condição de busca textual: o texto digitado (sem caixa e sem acento) tem
 * de aparecer no título, na descrição, nos nomes de empreendimento e
 * responsável ou nos rótulos de ação e canal. Os rótulos vêm como um JSON
 * de constantes (parâmetro), nunca interpolados. `immutable_unaccent` e
 * `lower` valem dos dois lados, na mesma ordem. Exige `REGISTRY_JOINS`.
 */
export function buildSearchCondition(
  params: SqlParams,
  searchTerm: string,
): string {
  const actionLabels = params.add(JSON.stringify(ACTION_LABEL));
  const channelLabels = params.add(JSON.stringify(CHANNEL_LABEL));
  const pattern = params.add(`%${escapeLikePattern(searchTerm)}%`);
  return `lower(immutable_unaccent(concat_ws(' ', b.title, b.description, e.name, o.name,
      ${actionLabels}::jsonb ->> b.action::text,
      ${channelLabels}::jsonb ->> b.channel::text)))
      LIKE lower(immutable_unaccent(${pattern})) ESCAPE '\\'`;
}

function buildRegistryCondition(
  params: SqlParams,
  column: string,
  value: string,
): string {
  return value === NO_REGISTRY
    ? `${column} IS NULL`
    : `${column} = ${params.add(value)}::uuid`;
}

/**
 * Condições dos filtros comuns (pautas excluídas nunca entram). `AND` entre
 * campos; dentro de `status`, `OR`.
 */
export function buildCommonConditions(
  params: SqlParams,
  filter: ContentBriefCommonFilter,
): string[] {
  const conditions = ['b.deleted_at IS NULL'];
  if (filter.status && filter.status.length > 0) {
    conditions.push(
      `b.status = ANY(${params.add(filter.status)}::content_brief_status[])`,
    );
  }
  if (filter.estateDevelopmentId) {
    conditions.push(
      buildRegistryCondition(
        params,
        'b.estate_development_id',
        filter.estateDevelopmentId,
      ),
    );
  }
  if (filter.ownerId) {
    conditions.push(
      buildRegistryCondition(params, 'b.owner_id', filter.ownerId),
    );
  }
  if (filter.action) {
    conditions.push(
      `b.action = ${params.add(filter.action)}::content_brief_action`,
    );
  }
  if (filter.searchTerm) {
    conditions.push(buildSearchCondition(params, filter.searchTerm));
  }
  return conditions;
}

/** `WHERE` da listagem: filtros comuns mais a situação do prazo (`OR`). */
export function buildListWhere(
  params: SqlParams,
  filter: ContentBriefListFilter,
): string {
  const conditions = buildCommonConditions(params, filter);
  if (filter.dueStatus && filter.dueStatus.length > 0) {
    const predicate = createDueStatusPredicates(params, filter.today);
    conditions.push(`(${filter.dueStatus.map(predicate).join(' OR ')})`);
  }
  return `WHERE ${conditions.join('\n      AND ')}`;
}

/** `WHERE` do resumo: só os filtros comuns (a situação do prazo é contada). */
export function buildSummaryWhere(
  params: SqlParams,
  filter: ContentBriefCommonFilter,
): string {
  return `WHERE ${buildCommonConditions(params, filter).join('\n      AND ')}`;
}

/**
 * `ORDER BY` de cada ordenação. Sem prazo por último nas duas de prazo
 * (`NULLS LAST` também no decrescente); desempate por título (colação
 * pt-BR, como o `localeCompare('pt-BR')` do protótipo) e por id.
 */
export function buildOrderBy(sort: ContentBriefSort): string {
  switch (sort) {
    case ContentBriefSort.DUE_DATE:
      return 'b.due_date ASC NULLS LAST, b.title COLLATE "pt_br" ASC, b.id ASC';
    case ContentBriefSort.DUE_DATE_DESC:
      return 'b.due_date DESC NULLS LAST, b.title COLLATE "pt_br" ASC, b.id ASC';
    case ContentBriefSort.UPDATED_AT:
      return 'b.updated_at DESC, b.id ASC';
  }
}

/** Alias da coluna de contagem de uma situação do prazo no resumo. */
export function dueStatusAlias(dueStatus: DueStatus): string {
  return `due_${dueStatus.replaceAll('-', '_')}`;
}

/** Alias da coluna de contagem de um status no resumo. */
export function statusAlias(status: ContentBriefStatus): string {
  return `status_${status.toLowerCase()}`;
}

/**
 * Colunas do resumo: o total e uma contagem `FILTER` por situação do prazo
 * e por status, todas numa única passada. `::int` porque `count(*)` é
 * `bigint` e o `pg` o devolveria como texto.
 */
export function buildSummaryColumns(
  params: SqlParams,
  today: CalendarDate,
): string {
  const predicate = createDueStatusPredicates(params, today);
  const byDueStatus = Object.values(DueStatus).map(
    (dueStatus) =>
      `count(*) FILTER (WHERE ${predicate(dueStatus)})::int AS ${dueStatusAlias(dueStatus)}`,
  );
  const byStatus = Object.values(ContentBriefStatus).map(
    (status) =>
      `count(*) FILTER (WHERE b.status = '${status}')::int AS ${statusAlias(status)}`,
  );
  return ['count(*)::int AS total', ...byDueStatus, ...byStatus].join(
    ',\n    ',
  );
}
