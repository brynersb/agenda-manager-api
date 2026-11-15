import type { ContentBriefReadModel } from '@/modules/content-brief/application/interfaces/repositories/content-brief-query.repository.interface';
import { FindContentBriefByIdQuery } from '@/modules/content-brief/application/queries/find-content-brief-by-id/find-content-brief-by-id.query';
import { ContentBriefStatus } from '@/modules/content-brief/domain/enums/content-brief-status';
import { DueStatus } from '@/modules/content-brief/domain/enums/due-status';
import { ContentBriefNotFoundError } from '@/modules/content-brief/domain/errors/content-brief.errors';
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
    estateDevelopment: { id: 'e-1', name: 'Bela Vista', active: false },
    owner: null,
    completedAt: null,
    version: 2,
    createdAt: new Date('2026-11-14T12:00:00Z'),
    createdBy: { id: 'u-1', name: 'Ana' },
    updatedAt: new Date('2026-11-14T12:00:00Z'),
    updatedBy: { id: 'u-1', name: 'Ana' },
    ...overrides,
  };
}

function createScenario(found: ContentBriefReadModel | null) {
  const queryRepository = {
    findOneById: vi.fn().mockResolvedValue(found),
    findAll: vi.fn(),
    summarize: vi.fn(),
  };
  return {
    query: new FindContentBriefByIdQuery(queryRepository, clock),
    queryRepository,
  };
}

describe('FindContentBriefByIdQuery', () => {
  it('devolve o read model com a situação do prazo para "hoje"', async () => {
    const { query, queryRepository } = createScenario(
      readModel({ dueDate: CalendarDate.of('2026-11-13') }),
    );

    const result = await query.execute({ id: 'b-1' });

    expect(queryRepository.findOneById).toHaveBeenCalledWith('b-1');
    expect(result).toMatchObject({
      id: 'b-1',
      version: 2,
      dueStatus: DueStatus.OVERDUE,
      daysUntilDue: -1,
      estateDevelopment: { id: 'e-1', name: 'Bela Vista', active: false },
    });
  });

  it('sem prazo: no-due-date', async () => {
    const { query } = createScenario(readModel());

    await expect(query.execute({ id: 'b-1' })).resolves.toMatchObject({
      dueStatus: DueStatus.NO_DUE_DATE,
      daysUntilDue: null,
    });
  });

  it('concluída com prazo vencido: completed', async () => {
    const { query } = createScenario(
      readModel({
        status: ContentBriefStatus.DONE,
        dueDate: CalendarDate.of('2026-11-01'),
      }),
    );

    await expect(query.execute({ id: 'b-1' })).resolves.toMatchObject({
      dueStatus: DueStatus.COMPLETED,
      daysUntilDue: -13,
    });
  });

  it('não encontrada (ou excluída): CONTENT_BRIEF_NOT_FOUND', async () => {
    const { query } = createScenario(null);

    await expect(query.execute({ id: 'x' })).rejects.toBeInstanceOf(
      ContentBriefNotFoundError,
    );
  });
});
