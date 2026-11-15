import type { ContentBriefCounts } from '@/modules/content-brief/application/interfaces/repositories/content-brief-query.repository.interface';
import { SummarizeContentBriefsQuery } from '@/modules/content-brief/application/queries/summarize-content-briefs/summarize-content-briefs.query';
import { ContentBriefAction } from '@/modules/content-brief/domain/enums/content-brief-action';
import { ContentBriefStatus } from '@/modules/content-brief/domain/enums/content-brief-status';
import type { ClockInterface } from '@/shared/application/interfaces/clock.interface';
import { CalendarDate } from '@/shared/domain/calendar-date';

const TODAY = CalendarDate.of('2026-11-14');
const clock: ClockInterface = { today: () => TODAY, now: vi.fn() };

const COUNTS: ContentBriefCounts = {
  total: 6,
  byDueStatus: {
    overdue: 1,
    today: 1,
    'next-7-days': 1,
    later: 1,
    'no-due-date': 1,
    completed: 1,
  },
  byStatus: { TODO: 3, IN_PROGRESS: 1, IN_REVIEW: 1, DONE: 1 },
};

function createScenario() {
  const queryRepository = {
    findOneById: vi.fn(),
    findAll: vi.fn(),
    summarize: vi.fn().mockResolvedValue(COUNTS),
  };
  return {
    query: new SummarizeContentBriefsQuery(queryRepository, clock),
    queryRepository,
  };
}

describe('SummarizeContentBriefsQuery', () => {
  it('repassa só os filtros comuns, com o "hoje" do relógio', async () => {
    const { query, queryRepository } = createScenario();

    await query.execute({
      status: [ContentBriefStatus.DONE],
      estateDevelopmentId: 'e-1',
      ownerId: 'none',
      action: ContentBriefAction.ANALYZE,
      q: 'outubro',
    });

    expect(queryRepository.summarize).toHaveBeenCalledWith({
      status: [ContentBriefStatus.DONE],
      estateDevelopmentId: 'e-1',
      ownerId: 'none',
      action: ContentBriefAction.ANALYZE,
      searchTerm: 'outubro',
      today: TODAY,
    });
  });

  it('devolve as contagens com o dia de referência', async () => {
    const { query } = createScenario();

    const summary = await query.execute({});

    expect(summary).toEqual({ today: TODAY, ...COUNTS });
  });
});
