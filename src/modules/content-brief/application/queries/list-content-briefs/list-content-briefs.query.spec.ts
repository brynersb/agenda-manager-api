import type { ContentBriefReadModel } from '@/modules/content-brief/application/interfaces/repositories/content-brief-query.repository.interface';
import { ListContentBriefsQuery } from '@/modules/content-brief/application/queries/list-content-briefs/list-content-briefs.query';
import { ContentBriefAction } from '@/modules/content-brief/domain/enums/content-brief-action';
import { ContentBriefSort } from '@/modules/content-brief/domain/enums/content-brief-sort';
import { ContentBriefStatus } from '@/modules/content-brief/domain/enums/content-brief-status';
import { DueStatus } from '@/modules/content-brief/domain/enums/due-status';
import type { ClockInterface } from '@/shared/application/interfaces/clock.interface';
import { CalendarDate } from '@/shared/domain/calendar-date';

const TODAY = CalendarDate.of('2026-11-14');
const clock: ClockInterface = { today: () => TODAY, now: vi.fn() };

function readModel(
  overrides: Partial<ContentBriefReadModel> = {},
): ContentBriefReadModel {
  return {
    id: 'b-1',
    title: 'Post',
    description: '',
    dueDate: null,
    status: ContentBriefStatus.TODO,
    action: null,
    channel: null,
    estateDevelopment: null,
    owner: null,
    completedAt: null,
    version: 1,
    createdAt: new Date('2026-11-14T12:00:00Z'),
    createdBy: { id: 'u-1', name: 'Ana' },
    updatedAt: new Date('2026-11-14T12:00:00Z'),
    updatedBy: { id: 'u-1', name: 'Ana' },
    ...overrides,
  };
}

function createScenario(items: ContentBriefReadModel[], total = items.length) {
  const queryRepository = {
    findOneById: vi.fn(),
    findAll: vi.fn().mockResolvedValue({ items, total }),
    summarize: vi.fn(),
  };
  return {
    query: new ListContentBriefsQuery(queryRepository, clock),
    queryRepository,
  };
}

describe('ListContentBriefsQuery', () => {
  it('repassa os filtros ao repositório junto com o "hoje" do relógio', async () => {
    const { query, queryRepository } = createScenario([]);

    await query.execute({
      dueStatus: [DueStatus.OVERDUE, DueStatus.TODAY],
      status: [ContentBriefStatus.TODO],
      estateDevelopmentId: 'none',
      ownerId: 'o-1',
      action: ContentBriefAction.CREATE,
      q: 'plantao',
      sort: ContentBriefSort.UPDATED_AT,
      page: 2,
      limit: 25,
    });

    expect(queryRepository.findAll).toHaveBeenCalledWith({
      dueStatus: [DueStatus.OVERDUE, DueStatus.TODAY],
      status: [ContentBriefStatus.TODO],
      estateDevelopmentId: 'none',
      ownerId: 'o-1',
      action: ContentBriefAction.CREATE,
      searchTerm: 'plantao',
      sort: ContentBriefSort.UPDATED_AT,
      page: 2,
      limit: 25,
      today: TODAY,
    });
  });

  it('devolve a página com total, page e limit', async () => {
    const { query } = createScenario([readModel()], 37);

    const result = await query.execute({
      sort: ContentBriefSort.DUE_DATE,
      page: 3,
      limit: 10,
    });

    expect(result).toMatchObject({ total: 37, page: 3, limit: 10 });
    expect(result.data).toHaveLength(1);
  });

  it('acrescenta dueStatus e daysUntilDue de cada item para "hoje"', async () => {
    const { query } = createScenario([
      readModel({ id: 'a', dueDate: CalendarDate.of('2026-11-13') }),
      readModel({ id: 'b', dueDate: CalendarDate.of('2026-11-14') }),
      readModel({ id: 'c', dueDate: CalendarDate.of('2026-11-21') }),
      readModel({ id: 'd', dueDate: CalendarDate.of('2026-11-22') }),
      readModel({ id: 'e' }),
      readModel({
        id: 'f',
        status: ContentBriefStatus.DONE,
        dueDate: CalendarDate.of('2026-11-01'),
      }),
    ]);

    const result = await query.execute({
      sort: ContentBriefSort.DUE_DATE,
      page: 1,
      limit: 50,
    });

    expect(
      result.data.map(({ id, dueStatus, daysUntilDue }) => ({
        id,
        dueStatus,
        daysUntilDue,
      })),
    ).toEqual([
      { id: 'a', dueStatus: DueStatus.OVERDUE, daysUntilDue: -1 },
      { id: 'b', dueStatus: DueStatus.TODAY, daysUntilDue: 0 },
      { id: 'c', dueStatus: DueStatus.NEXT_7_DAYS, daysUntilDue: 7 },
      { id: 'd', dueStatus: DueStatus.LATER, daysUntilDue: 8 },
      { id: 'e', dueStatus: DueStatus.NO_DUE_DATE, daysUntilDue: null },
      { id: 'f', dueStatus: DueStatus.COMPLETED, daysUntilDue: -13 },
    ]);
  });

  it('lista vazia: data vazio e total zero', async () => {
    const { query } = createScenario([]);

    await expect(
      query.execute({ sort: ContentBriefSort.DUE_DATE, page: 1, limit: 50 }),
    ).resolves.toEqual({ data: [], total: 0, page: 1, limit: 50 });
  });
});
