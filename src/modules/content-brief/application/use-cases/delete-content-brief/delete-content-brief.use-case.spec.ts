import type { ContentBriefRepositoryInterface } from '@/modules/content-brief/application/interfaces/repositories/content-brief.repository.interface';
import { DeleteContentBriefUseCase } from '@/modules/content-brief/application/use-cases/delete-content-brief/delete-content-brief.use-case';
import { ContentBriefDomainEntity } from '@/modules/content-brief/domain/entities/content-brief.domain-entity';
import { ContentBriefStatus } from '@/modules/content-brief/domain/enums/content-brief-status';
import { ContentBriefNotFoundError } from '@/modules/content-brief/domain/errors/content-brief.errors';
import { Description } from '@/modules/content-brief/domain/value-objects/description';
import { Title } from '@/modules/content-brief/domain/value-objects/title';
import type { ClockInterface } from '@/shared/application/interfaces/clock.interface';
import type { LoggerServiceInterface } from '@/shared/application/interfaces/logger.service.interface';
import { newAudit } from '@/shared/domain/audit';

const actor = { id: 'u-2', name: 'Bia' };
const NOW = new Date('2026-11-15T12:00:00Z');
const fixedClock: ClockInterface = { now: () => NOW, today: vi.fn() };

function existing() {
  return ContentBriefDomainEntity.restore({
    id: 'b-1',
    title: Title.restore('Post'),
    description: Description.restore(''),
    dueDate: null,
    status: ContentBriefStatus.TODO,
    action: null,
    channel: null,
    estateDevelopmentId: null,
    ownerId: null,
    completedAt: null,
    deletion: null,
    version: 1,
    audit: newAudit(
      { id: 'u-1', name: 'Ana' },
      new Date('2026-11-14T12:00:00Z'),
    ),
  });
}

function createScenario() {
  const repository = {
    findById: vi.fn().mockResolvedValue(existing()),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn().mockResolvedValue(undefined),
  } satisfies ContentBriefRepositoryInterface;
  const logger = {
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    setLogPrefix: vi.fn(),
  } satisfies LoggerServiceInterface;
  const useCase = new DeleteContentBriefUseCase(repository, fixedClock, logger);
  return { useCase, repository, logger };
}

describe('DeleteContentBriefUseCase', () => {
  it('marca quem e quando excluiu, grava a exclusão lógica e loga', async () => {
    const { useCase, repository, logger } = createScenario();

    await expect(
      useCase.execute({ id: 'b-1', actor }),
    ).resolves.toBeUndefined();

    const [deleted] = repository.softDelete.mock.calls[0];
    expect(deleted.deletion).toEqual({ at: NOW, by: 'u-2' });
    expect(deleted.audit).toMatchObject({ updatedBy: 'u-2', updatedAt: NOW });
    expect(logger.info).toHaveBeenCalledWith(
      'Pauta excluída',
      expect.objectContaining({
        'evt.name': 'content_brief.deleted',
        outcome: 'success',
        content_brief_id: 'b-1',
        user_sub: 'u-2',
      }),
    );
  });

  it('não encontrada (ou já excluída): 404 sem gravar', async () => {
    const { useCase, repository, logger } = createScenario();
    repository.findById.mockResolvedValue(null);

    await expect(useCase.execute({ id: 'x', actor })).rejects.toBeInstanceOf(
      ContentBriefNotFoundError,
    );
    expect(repository.softDelete).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('corrida: excluída por outra pessoa entre a leitura e o UPDATE propaga 404 sem logar sucesso', async () => {
    const { useCase, repository, logger } = createScenario();
    repository.softDelete.mockRejectedValue(new ContentBriefNotFoundError());

    await expect(useCase.execute({ id: 'b-1', actor })).rejects.toBeInstanceOf(
      ContentBriefNotFoundError,
    );
    expect(logger.info).not.toHaveBeenCalled();
  });
});
