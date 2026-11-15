import { ContentBriefAction } from '@/modules/content-brief/domain/enums/content-brief-action';
import { ContentBriefSort } from '@/modules/content-brief/domain/enums/content-brief-sort';
import { ContentBriefStatus } from '@/modules/content-brief/domain/enums/content-brief-status';
import { DueStatus } from '@/modules/content-brief/domain/enums/due-status';
import {
  buildCommonConditions,
  buildListWhere,
  buildOrderBy,
  buildSearchCondition,
  buildSummaryColumns,
  createDueStatusPredicates,
  dueStatusAlias,
  escapeLikePattern,
  SqlParams,
  statusAlias,
} from '@/modules/content-brief/infrastructure/persistence/repositories/content-brief/content-brief-filter.sql';
import { CalendarDate } from '@/shared/domain/calendar-date';

const TODAY = CalendarDate.of('2026-11-14');

/** Marcadores `$n` que aparecem no texto, sem repetição. */
function placeholdersIn(sql: string): string[] {
  return [...new Set(sql.match(/\$\d+/g) ?? [])].sort();
}

describe('escapeLikePattern', () => {
  it('escapa %, _ e a própria barra invertida', () => {
    expect(escapeLikePattern('100%')).toBe('100\\%');
    expect(escapeLikePattern('a_c')).toBe('a\\_c');
    expect(escapeLikePattern('C:\\pasta')).toBe('C:\\\\pasta');
  });

  it('deixa o resto como está', () => {
    expect(escapeLikePattern('plantão de vendas')).toBe('plantão de vendas');
  });
});

describe('createDueStatusPredicates', () => {
  it.each([
    [DueStatus.OVERDUE, "b.status <> 'DONE' AND b.due_date < $1::date"],
    [DueStatus.TODAY, "b.status <> 'DONE' AND b.due_date = $1::date"],
    [DueStatus.NO_DUE_DATE, "b.status <> 'DONE' AND b.due_date IS NULL"],
    [DueStatus.COMPLETED, "b.status = 'DONE'"],
  ])('%s', (dueStatus, expected) => {
    const params = new SqlParams();

    const sql = createDueStatusPredicates(params, TODAY)(dueStatus);

    expect(sql).toContain(expected);
  });

  it('próximos 7 dias: de amanhã (exclusive hoje) até hoje + 7', () => {
    const params = new SqlParams();

    const sql = createDueStatusPredicates(params, TODAY)(DueStatus.NEXT_7_DAYS);

    expect(sql).toContain('b.due_date > $1::date AND b.due_date <= $2::date');
    expect(params.values).toEqual(['2026-11-14', '2026-11-21']);
  });

  it('mais adiante: depois de hoje + 7', () => {
    const params = new SqlParams();

    const sql = createDueStatusPredicates(params, TODAY)(DueStatus.LATER);

    expect(sql).toContain('b.due_date > $1::date');
    expect(params.values).toEqual(['2026-11-21']);
  });

  it('só registra parâmetro de data quando o predicado o usa', () => {
    const params = new SqlParams();
    const predicate = createDueStatusPredicates(params, TODAY);

    predicate(DueStatus.COMPLETED);
    predicate(DueStatus.NO_DUE_DATE);

    expect(params.values).toEqual([]);
  });

  it('reaproveita o mesmo parâmetro de hoje em vários predicados', () => {
    const params = new SqlParams();
    const predicate = createDueStatusPredicates(params, TODAY);

    const sql = [DueStatus.OVERDUE, DueStatus.TODAY, DueStatus.NEXT_7_DAYS]
      .map(predicate)
      .join(' ');

    expect(params.values).toEqual(['2026-11-14', '2026-11-21']);
    expect(placeholdersIn(sql)).toEqual(['$1', '$2']);
  });
});

describe('buildSearchCondition', () => {
  it('escapa o termo e nunca o interpola no SQL', () => {
    const params = new SqlParams();

    const sql = buildSearchCondition(params, "100%'; DROP TABLE x; --");

    expect(sql).not.toContain('DROP TABLE');
    expect(params.values.at(-1)).toBe("%100\\%'; DROP TABLE x; --%");
    expect(sql).toContain("ESCAPE '\\'");
    expect(sql).toContain('immutable_unaccent');
  });

  it('passa os rótulos de ação e canal como JSON por parâmetro', () => {
    const params = new SqlParams();

    buildSearchCondition(params, 'cobrar');

    const [actions, channels] = params.values as string[];
    expect(JSON.parse(actions ?? '{}')).toMatchObject({ CHASE: 'Cobrar' });
    expect(JSON.parse(channels ?? '{}')).toMatchObject({ ADS: 'Anúncios' });
  });
});

describe('buildCommonConditions', () => {
  it('sempre exclui as pautas excluídas e, sem filtro, só isso', () => {
    const params = new SqlParams();

    const conditions = buildCommonConditions(params, { today: TODAY });

    expect(conditions).toEqual(['b.deleted_at IS NULL']);
    expect(params.values).toEqual([]);
  });

  it('none vira IS NULL (sem parâmetro); uuid vira igualdade', () => {
    const params = new SqlParams();
    const id = '0192f6a0-7c1e-7a3b-9d52-4f1e8b6c2a10';

    const conditions = buildCommonConditions(params, {
      estateDevelopmentId: 'none',
      ownerId: id,
      today: TODAY,
    });

    expect(conditions).toContain('b.estate_development_id IS NULL');
    expect(conditions).toContain('b.owner_id = $1::uuid');
    expect(params.values).toEqual([id]);
  });

  it('status em lista vira ANY e ação vira igualdade', () => {
    const params = new SqlParams();

    const conditions = buildCommonConditions(params, {
      status: [ContentBriefStatus.TODO, ContentBriefStatus.DONE],
      action: ContentBriefAction.CHASE,
      today: TODAY,
    });

    expect(conditions).toContain('b.status = ANY($1::content_brief_status[])');
    expect(conditions).toContain('b.action = $2::content_brief_action');
    expect(params.values).toEqual([['TODO', 'DONE'], 'CHASE']);
  });
});

describe('buildListWhere', () => {
  it('une as situações do prazo com OR e referencia todo parâmetro registrado', () => {
    const params = new SqlParams();

    const where = buildListWhere(params, {
      dueStatus: [DueStatus.OVERDUE, DueStatus.COMPLETED],
      today: TODAY,
      sort: ContentBriefSort.DUE_DATE,
      page: 1,
      limit: 50,
    });

    expect(where).toContain(' OR ');
    expect(placeholdersIn(where)).toHaveLength(params.values.length);
  });

  it('sem situação do prazo, não filtra por data', () => {
    const params = new SqlParams();

    const where = buildListWhere(params, {
      today: TODAY,
      sort: ContentBriefSort.DUE_DATE,
      page: 1,
      limit: 50,
    });

    expect(where).not.toContain('due_date');
    expect(params.values).toEqual([]);
  });
});

describe('buildOrderBy', () => {
  it('dueDate: crescente, sem prazo por último, título pt-BR, id', () => {
    expect(buildOrderBy(ContentBriefSort.DUE_DATE)).toBe(
      'b.due_date ASC NULLS LAST, b.title COLLATE "pt_br" ASC, b.id ASC',
    );
  });

  it('-dueDate: decrescente, ainda com sem prazo por último', () => {
    expect(buildOrderBy(ContentBriefSort.DUE_DATE_DESC)).toBe(
      'b.due_date DESC NULLS LAST, b.title COLLATE "pt_br" ASC, b.id ASC',
    );
  });

  it('updatedAt: mais recentes primeiro', () => {
    expect(buildOrderBy(ContentBriefSort.UPDATED_AT)).toBe(
      'b.updated_at DESC, b.id ASC',
    );
  });
});

describe('buildSummaryColumns', () => {
  it('traz total e uma coluna por situação do prazo e por status', () => {
    const params = new SqlParams();

    const columns = buildSummaryColumns(params, TODAY);

    expect(columns).toContain('count(*)::int AS total');
    for (const dueStatus of Object.values(DueStatus)) {
      expect(columns).toContain(`AS ${dueStatusAlias(dueStatus)}`);
    }
    for (const status of Object.values(ContentBriefStatus)) {
      expect(columns).toContain(`AS ${statusAlias(status)}`);
    }
    expect(params.values).toEqual(['2026-11-14', '2026-11-21']);
  });

  it('os aliases são identificadores SQL válidos', () => {
    expect(dueStatusAlias(DueStatus.NEXT_7_DAYS)).toBe('due_next_7_days');
    expect(statusAlias(ContentBriefStatus.IN_PROGRESS)).toBe(
      'status_in_progress',
    );
  });
});
