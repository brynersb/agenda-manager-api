import type { ContentBriefRepositoryInterface } from '@/modules/content-brief/application/interfaces/repositories/content-brief.repository.interface';
import type { RegistryQueryRepositoryInterface } from '@/modules/content-brief/application/interfaces/repositories/registry-query.repository.interface';
import type { FindContentBriefByIdQueryInterface } from '@/modules/content-brief/application/queries/find-content-brief-by-id/find-content-brief-by-id.query.interface';
import { UpdateContentBriefUseCase } from '@/modules/content-brief/application/use-cases/update-content-brief/update-content-brief.use-case';
import type { UpdateContentBriefInput } from '@/modules/content-brief/application/use-cases/update-content-brief/update-content-brief.use-case.interface';
import { ContentBriefDomainEntity } from '@/modules/content-brief/domain/entities/content-brief.domain-entity';
import { ContentBriefAction } from '@/modules/content-brief/domain/enums/content-brief-action';
import { ContentBriefStatus } from '@/modules/content-brief/domain/enums/content-brief-status';
import {
  ContentBriefNotFoundError,
  ContentBriefVersionOutdatedError,
  EstateDevelopmentUnavailableError,
  InvalidTitleError,
  OwnerUnavailableError,
} from '@/modules/content-brief/domain/errors/content-brief.errors';
import { Description } from '@/modules/content-brief/domain/value-objects/description';
import { Title } from '@/modules/content-brief/domain/value-objects/title';
import type { ClockInterface } from '@/shared/application/interfaces/clock.interface';
import type { LoggerServiceInterface } from '@/shared/application/interfaces/logger.service.interface';
import { newAudit } from '@/shared/domain/audit';
import { CalendarDate } from '@/shared/domain/calendar-date';

const actor = { id: 'u-2', name: 'Bia' };
const NOW = new Date('2026-11-15T12:00:00Z');
const fixedClock: ClockInterface = { now: () => NOW, today: vi.fn() };

function existing(version = 3) {
  return ContentBriefDomainEntity.restore({
    id: 'b-1',
    title: Title.restore('Antigo'),
    description: Description.restore('antiga'),
    dueDate: CalendarDate.of('2026-11-20'),
    status: ContentBriefStatus.IN_REVIEW,
    action: ContentBriefAction.CREATE,
    channel: null,
    estateDevelopmentId: 'e-1',
    ownerId: 'o-1',
    completedAt: null,
    deletion: null,
    version,
    audit: newAudit(
      { id: 'u-1', name: 'Ana' },
      new Date('2026-11-14T12:00:00Z'),
    ),
  });
}

function input(
  overrides: Partial<UpdateContentBriefInput> = {},
): UpdateContentBriefInput {
  return {
    id: 'b-1',
    title: 'Novo',
    description: null,
    dueDate: null,
    status: null,
    action: null,
    channel: null,
    estateDevelopmentId: 'e-1',
    ownerId: 'o-1',
    version: 3,
    actor,
    ...overrides,
  };
}

function createScenario() {
  const repository = {
    findById: vi.fn().mockResolvedValue(existing()),
    create: vi.fn(),
    update: vi.fn().mockResolvedValue(undefined),
    softDelete: vi.fn(),
  } satisfies ContentBriefRepositoryInterface;
  const registryQueryRepository = {
    findEstateDevelopmentStatus: vi.fn().mockResolvedValue('active'),
    findOwnerStatus: vi.fn().mockResolvedValue('active'),
  } satisfies RegistryQueryRepositoryInterface;
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
  const useCase = new UpdateContentBriefUseCase(
    repository,
    registryQueryRepository,
    findContentBriefById as unknown as FindContentBriefByIdQueryInterface,
    fixedClock,
    logger,
  );
  return { useCase, repository, registryQueryRepository, logger };
}

describe('UpdateContentBriefUseCase', () => {
  it('substitui os campos, grava com a versão esperada e devolve o detalhe', async () => {
    const { useCase, repository, logger } = createScenario();

    const result = await useCase.execute(input());

    const [saved, expectedVersion] = repository.update.mock.calls[0];
    expect(saved.title.value).toBe('Novo');
    expect(saved.description.value).toBe('');
    expect(saved.dueDate).toBeNull();
    expect(saved.action).toBeNull();
    expect(saved.audit).toMatchObject({
      createdBy: 'u-1',
      updatedBy: 'u-2',
      updatedAt: NOW,
    });
    expect(expectedVersion).toBe(3);
    expect(result).toEqual({ id: 'b-1', version: 4 });
    expect(logger.info).toHaveBeenCalledWith(
      'Pauta editada',
      expect.objectContaining({
        'evt.name': 'content_brief.updated',
        outcome: 'success',
        content_brief_id: 'b-1',
      }),
    );
  });

  it('status ausente mantém o atual; informado troca e grava completedAt em DONE', async () => {
    const kept = createScenario();
    await kept.useCase.execute(input());
    expect(kept.repository.update.mock.calls[0][0].status).toBe(
      ContentBriefStatus.IN_REVIEW,
    );

    const done = createScenario();
    await done.useCase.execute(input({ status: ContentBriefStatus.DONE }));
    const [saved] = done.repository.update.mock.calls[0];
    expect(saved.status).toBe(ContentBriefStatus.DONE);
    expect(saved.completedAt).toBe(NOW);
  });

  it('manter o cadastro já atribuído (mesmo arquivado depois) não consulta cadastros', async () => {
    const { useCase, registryQueryRepository, repository } = createScenario();
    registryQueryRepository.findEstateDevelopmentStatus.mockResolvedValue(
      'archived',
    );
    registryQueryRepository.findOwnerStatus.mockResolvedValue('archived');

    await useCase.execute(input());

    expect(
      registryQueryRepository.findEstateDevelopmentStatus,
    ).not.toHaveBeenCalled();
    expect(registryQueryRepository.findOwnerStatus).not.toHaveBeenCalled();
    expect(repository.update).toHaveBeenCalledTimes(1);
  });

  it('trocar para empreendimento ativo valida e passa', async () => {
    const { useCase, registryQueryRepository, repository } = createScenario();

    await useCase.execute(input({ estateDevelopmentId: 'e-2' }));

    expect(
      registryQueryRepository.findEstateDevelopmentStatus,
    ).toHaveBeenCalledWith('e-2');
    expect(registryQueryRepository.findOwnerStatus).not.toHaveBeenCalled();
    expect(repository.update.mock.calls[0][0].estateDevelopmentId).toBe('e-2');
  });

  it('trocar para empreendimento arquivado bloqueia sem gravar', async () => {
    const { useCase, registryQueryRepository, repository } = createScenario();
    registryQueryRepository.findEstateDevelopmentStatus.mockResolvedValue(
      'archived',
    );

    await expect(
      useCase.execute(input({ estateDevelopmentId: 'e-2' })),
    ).rejects.toBeInstanceOf(EstateDevelopmentUnavailableError);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('trocar para responsável inexistente bloqueia', async () => {
    const { useCase, registryQueryRepository, repository } = createScenario();
    registryQueryRepository.findOwnerStatus.mockResolvedValue('missing');

    await expect(
      useCase.execute(input({ ownerId: 'o-9' })),
    ).rejects.toBeInstanceOf(OwnerUnavailableError);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('limpar o cadastro (null) é permitido e não consulta cadastros', async () => {
    const { useCase, registryQueryRepository, repository } = createScenario();

    await useCase.execute(input({ estateDevelopmentId: null, ownerId: null }));

    expect(
      registryQueryRepository.findEstateDevelopmentStatus,
    ).not.toHaveBeenCalled();
    expect(repository.update.mock.calls[0][0].estateDevelopmentId).toBeNull();
    expect(repository.update.mock.calls[0][0].ownerId).toBeNull();
  });

  it('não encontrada', async () => {
    const { useCase, repository } = createScenario();
    repository.findById.mockResolvedValue(null);

    await expect(useCase.execute(input())).rejects.toBeInstanceOf(
      ContentBriefNotFoundError,
    );
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('título inválido é recusado antes de ler o banco', async () => {
    const { useCase, repository } = createScenario();

    await expect(useCase.execute(input({ title: '' }))).rejects.toBeInstanceOf(
      InvalidTitleError,
    );
    expect(repository.findById).not.toHaveBeenCalled();
  });

  it('versão desatualizada: 409 antes de validar cadastros, com log blocked', async () => {
    const { useCase, repository, registryQueryRepository, logger } =
      createScenario();

    await expect(
      useCase.execute(input({ version: 2, estateDevelopmentId: 'e-2' })),
    ).rejects.toBeInstanceOf(ContentBriefVersionOutdatedError);

    expect(repository.update).not.toHaveBeenCalled();
    expect(
      registryQueryRepository.findEstateDevelopmentStatus,
    ).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        'evt.name': 'content_brief.version_conflict',
        outcome: 'blocked',
        operation: 'update',
        content_brief_id: 'b-1',
        user_sub: 'u-2',
      }),
    );
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('corrida: versão desatualizada vinda do repositório é propagada e logada', async () => {
    const { useCase, repository, logger } = createScenario();
    repository.update.mockRejectedValue(new ContentBriefVersionOutdatedError());

    await expect(useCase.execute(input())).rejects.toBeInstanceOf(
      ContentBriefVersionOutdatedError,
    );
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('corrida: pauta excluída entre a leitura e o UPDATE propaga 404 sem log de conflito', async () => {
    const { useCase, repository, logger } = createScenario();
    repository.update.mockRejectedValue(new ContentBriefNotFoundError());

    await expect(useCase.execute(input())).rejects.toBeInstanceOf(
      ContentBriefNotFoundError,
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
