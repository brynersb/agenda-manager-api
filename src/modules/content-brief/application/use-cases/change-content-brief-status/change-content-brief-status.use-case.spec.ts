import type { ContentBriefRepositoryInterface } from '@/modules/content-brief/application/interfaces/repositories/content-brief.repository.interface';
import type { FindContentBriefByIdQueryInterface } from '@/modules/content-brief/application/queries/find-content-brief-by-id/find-content-brief-by-id.query.interface';
import { ChangeContentBriefStatusUseCase } from '@/modules/content-brief/application/use-cases/change-content-brief-status/change-content-brief-status.use-case';
import { ContentBriefDomainEntity } from '@/modules/content-brief/domain/entities/content-brief.domain-entity';
import { ContentBriefStatus } from '@/modules/content-brief/domain/enums/content-brief-status';
import {
  ContentBriefNotFoundError,
  ContentBriefVersionOutdatedError,
} from '@/modules/content-brief/domain/errors/content-brief.errors';
import { Description } from '@/modules/content-brief/domain/value-objects/description';
import { Title } from '@/modules/content-brief/domain/value-objects/title';
import type { ClockInterface } from '@/shared/application/interfaces/clock.interface';
import type { LoggerServiceInterface } from '@/shared/application/interfaces/logger.service.interface';
import { newAudit } from '@/shared/domain/audit';

const actor = { id: 'u-2', name: 'Bia' };
const NOW = new Date('2026-11-15T12:00:00Z');
const fixedClock: ClockInterface = { now: () => NOW, today: vi.fn() };

function existing(status = ContentBriefStatus.TODO, version = 3) {
  return ContentBriefDomainEntity.restore({
    id: 'b-1',
    title: Title.restore('Post'),
    description: Description.restore(''),
    dueDate: null,
    status,
    action: null,
    channel: null,
    estateDevelopmentId: 'e-arquivado',
    ownerId: null,
    completedAt:
      status === ContentBriefStatus.DONE
        ? new Date('2026-11-14T12:00:00Z')
        : null,
    deletion: null,
    version,
    audit: newAudit(
      { id: 'u-1', name: 'Ana' },
      new Date('2026-11-14T12:00:00Z'),
    ),
  });
}

function createScenario(found = existing()) {
  const repository = {
    findById: vi.fn().mockResolvedValue(found),
    create: vi.fn(),
    update: vi.fn().mockResolvedValue(undefined),
    softDelete: vi.fn(),
  } satisfies ContentBriefRepositoryInterface;
  const findContentBriefById = {
    execute: vi.fn().mockResolvedValue({ id: 'b-1', version: 4 }),
  };
  const logger = {
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    setLogPrefix: vi.fn(),
  } satisfies LoggerServiceInterface;
  const useCase = new ChangeContentBriefStatusUseCase(
    repository,
    findContentBriefById as unknown as FindContentBriefByIdQueryInterface,
    fixedClock,
    logger,
  );
  return { useCase, repository, findContentBriefById, logger };
}

describe('ChangeContentBriefStatusUseCase', () => {
  it('troca o status, grava com a versão esperada e devolve o detalhe', async () => {
    const { useCase, repository, logger } = createScenario();

    const result = await useCase.execute({
      id: 'b-1',
      status: ContentBriefStatus.IN_PROGRESS,
      version: 3,
      actor,
    });

    const [saved, expectedVersion] = repository.update.mock.calls[0];
    expect(saved.status).toBe(ContentBriefStatus.IN_PROGRESS);
    expect(saved.audit).toMatchObject({ updatedBy: 'u-2', updatedAt: NOW });
    expect(expectedVersion).toBe(3);
    expect(result).toEqual({ id: 'b-1', version: 4 });
    expect(logger.info).toHaveBeenCalledWith(
      'Status da pauta alterado',
      expect.objectContaining({
        'evt.name': 'content_brief.status_changed',
        outcome: 'success',
        content_brief_id: 'b-1',
        previous_status: ContentBriefStatus.TODO,
        new_status: ContentBriefStatus.IN_PROGRESS,
        user_sub: 'u-2',
      }),
    );
  });

  it('entrar em DONE grava completedAt', async () => {
    const { useCase, repository } = createScenario();

    await useCase.execute({
      id: 'b-1',
      status: ContentBriefStatus.DONE,
      version: 3,
      actor,
    });

    expect(repository.update.mock.calls[0][0].completedAt).toBe(NOW);
  });

  it('sair de DONE limpa completedAt', async () => {
    const { useCase, repository } = createScenario(
      existing(ContentBriefStatus.DONE),
    );

    await useCase.execute({
      id: 'b-1',
      status: ContentBriefStatus.TODO,
      version: 3,
      actor,
    });

    expect(repository.update.mock.calls[0][0].completedAt).toBeNull();
  });

  it('não valida cadastros: mantém o empreendimento já atribuído', async () => {
    const { useCase, repository } = createScenario();

    await useCase.execute({
      id: 'b-1',
      status: ContentBriefStatus.IN_REVIEW,
      version: 3,
      actor,
    });

    expect(repository.update.mock.calls[0][0].estateDevelopmentId).toBe(
      'e-arquivado',
    );
  });

  it('não encontrada', async () => {
    const { useCase, repository } = createScenario();
    repository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        id: 'x',
        status: ContentBriefStatus.DONE,
        version: 1,
        actor,
      }),
    ).rejects.toBeInstanceOf(ContentBriefNotFoundError);
  });

  it('versão desatualizada: 409, não grava e loga blocked', async () => {
    const { useCase, repository, logger } = createScenario();

    await expect(
      useCase.execute({
        id: 'b-1',
        status: ContentBriefStatus.DONE,
        version: 2,
        actor,
      }),
    ).rejects.toBeInstanceOf(ContentBriefVersionOutdatedError);

    expect(repository.update).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        'evt.name': 'content_brief.version_conflict',
        outcome: 'blocked',
        operation: 'change_status',
      }),
    );
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('corrida: versão desatualizada vinda do repositório é propagada e logada', async () => {
    const { useCase, repository, logger } = createScenario();
    repository.update.mockRejectedValue(new ContentBriefVersionOutdatedError());

    await expect(
      useCase.execute({
        id: 'b-1',
        status: ContentBriefStatus.DONE,
        version: 3,
        actor,
      }),
    ).rejects.toBeInstanceOf(ContentBriefVersionOutdatedError);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.info).not.toHaveBeenCalled();
  });
});
