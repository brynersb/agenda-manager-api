import type { ContentBriefRepositoryInterface } from '@/modules/content-brief/application/interfaces/repositories/content-brief.repository.interface';
import type {
  RegistryQueryRepositoryInterface,
  RegistryStatus,
} from '@/modules/content-brief/application/interfaces/repositories/registry-query.repository.interface';
import type { FindContentBriefByIdQueryInterface } from '@/modules/content-brief/application/queries/find-content-brief-by-id/find-content-brief-by-id.query.interface';
import { CreateContentBriefUseCase } from '@/modules/content-brief/application/use-cases/create-content-brief/create-content-brief.use-case';
import type { CreateContentBriefInput } from '@/modules/content-brief/application/use-cases/create-content-brief/create-content-brief.use-case.interface';
import { ContentBriefAction } from '@/modules/content-brief/domain/enums/content-brief-action';
import { ContentBriefChannel } from '@/modules/content-brief/domain/enums/content-brief-channel';
import { ContentBriefStatus } from '@/modules/content-brief/domain/enums/content-brief-status';
import {
  EstateDevelopmentUnavailableError,
  InvalidDescriptionError,
  InvalidDueDateError,
  InvalidTitleError,
  OwnerUnavailableError,
} from '@/modules/content-brief/domain/errors/content-brief.errors';
import type { ClockInterface } from '@/shared/application/interfaces/clock.interface';
import type { LoggerServiceInterface } from '@/shared/application/interfaces/logger.service.interface';

const actor = { id: 'u-1', name: 'Ana' };
const NOW = new Date('2026-11-14T12:00:00Z');
const fixedClock: ClockInterface = { now: () => NOW, today: vi.fn() };

function input(
  overrides: Partial<CreateContentBriefInput> = {},
): CreateContentBriefInput {
  return {
    title: 'Post de lançamento',
    description: null,
    dueDate: null,
    status: null,
    action: null,
    channel: null,
    estateDevelopmentId: null,
    ownerId: null,
    actor,
    ...overrides,
  };
}

function createScenario(
  statuses: { estate?: RegistryStatus; owner?: RegistryStatus } = {},
) {
  const repository = {
    findById: vi.fn(),
    create: vi.fn().mockResolvedValue(undefined),
    update: vi.fn(),
    softDelete: vi.fn(),
  } satisfies ContentBriefRepositoryInterface;
  const registryQueryRepository = {
    findEstateDevelopmentStatus: vi
      .fn()
      .mockResolvedValue(statuses.estate ?? 'active'),
    findOwnerStatus: vi.fn().mockResolvedValue(statuses.owner ?? 'active'),
  } satisfies RegistryQueryRepositoryInterface;
  const findContentBriefById = {
    execute: vi.fn().mockImplementation(async ({ id }: { id: string }) => ({
      id,
      version: 1,
    })),
  };
  const logger = {
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    setLogPrefix: vi.fn(),
  } satisfies LoggerServiceInterface;
  const useCase = new CreateContentBriefUseCase(
    repository,
    registryQueryRepository,
    findContentBriefById as unknown as FindContentBriefByIdQueryInterface,
    fixedClock,
    logger,
  );
  return {
    useCase,
    repository,
    registryQueryRepository,
    findContentBriefById,
    logger,
  };
}

describe('CreateContentBriefUseCase', () => {
  it('cria em TODO, com auditoria do ator, e devolve o detalhe lido do banco', async () => {
    const { useCase, repository, findContentBriefById, logger } =
      createScenario();

    const result = await useCase.execute(input({ title: '  Post  ' }));

    const [saved] = repository.create.mock.calls[0];
    expect(saved.title.value).toBe('Post');
    expect(saved.description.value).toBe('');
    expect(saved.status).toBe(ContentBriefStatus.TODO);
    expect(saved.version).toBe(1);
    expect(saved.audit).toMatchObject({
      createdBy: 'u-1',
      createdByName: 'Ana',
      createdAt: NOW,
    });
    expect(findContentBriefById.execute).toHaveBeenCalledWith({
      id: saved.id,
    });
    expect(result).toEqual({ id: saved.id, version: 1 });
    expect(logger.info).toHaveBeenCalledWith(
      'Pauta criada',
      expect.objectContaining({
        'evt.name': 'content_brief.created',
        outcome: 'success',
        content_brief_id: saved.id,
        user_sub: 'u-1',
      }),
    );
  });

  it('nunca loga título nem descrição', async () => {
    const { useCase, logger } = createScenario();

    await useCase.execute(
      input({ title: 'Segredo comercial', description: 'Detalhe sigiloso' }),
    );

    const logged = JSON.stringify(logger.info.mock.calls);
    expect(logged).not.toContain('Segredo comercial');
    expect(logged).not.toContain('Detalhe sigiloso');
  });

  it('grava todos os campos informados', async () => {
    const { useCase, repository } = createScenario();

    await useCase.execute(
      input({
        description: ' Arte aprovada ',
        dueDate: '2026-11-14',
        status: ContentBriefStatus.IN_PROGRESS,
        action: ContentBriefAction.CREATE,
        channel: ContentBriefChannel.INSTAGRAM,
        estateDevelopmentId: 'e-1',
        ownerId: 'o-1',
      }),
    );

    const [saved] = repository.create.mock.calls[0];
    expect(saved.description.value).toBe('Arte aprovada');
    expect(saved.dueDate.toString()).toBe('2026-11-14');
    expect(saved.status).toBe(ContentBriefStatus.IN_PROGRESS);
    expect(saved.action).toBe(ContentBriefAction.CREATE);
    expect(saved.channel).toBe(ContentBriefChannel.INSTAGRAM);
    expect(saved.estateDevelopmentId).toBe('e-1');
    expect(saved.ownerId).toBe('o-1');
  });

  it('criar já em DONE grava completedAt', async () => {
    const { useCase, repository } = createScenario();

    await useCase.execute(input({ status: ContentBriefStatus.DONE }));

    expect(repository.create.mock.calls[0][0].completedAt).toBe(NOW);
  });

  it('valida empreendimento e responsável atribuídos', async () => {
    const { useCase, registryQueryRepository } = createScenario();

    await useCase.execute(
      input({ estateDevelopmentId: 'e-1', ownerId: 'o-1' }),
    );

    expect(
      registryQueryRepository.findEstateDevelopmentStatus,
    ).toHaveBeenCalledWith('e-1');
    expect(registryQueryRepository.findOwnerStatus).toHaveBeenCalledWith('o-1');
  });

  it('sem cadastros informados, não consulta cadastros', async () => {
    const { useCase, registryQueryRepository } = createScenario();

    await useCase.execute(input());

    expect(
      registryQueryRepository.findEstateDevelopmentStatus,
    ).not.toHaveBeenCalled();
    expect(registryQueryRepository.findOwnerStatus).not.toHaveBeenCalled();
  });

  it.each<[RegistryStatus, string]>([
    ['archived', 'arquivado'],
    ['missing', 'não existe'],
  ])(
    'empreendimento %s bloqueia com ESTATE_DEVELOPMENT_UNAVAILABLE',
    async (status, text) => {
      const { useCase, repository } = createScenario({ estate: status });

      const result = useCase.execute(input({ estateDevelopmentId: 'e-1' }));

      await expect(result).rejects.toBeInstanceOf(
        EstateDevelopmentUnavailableError,
      );
      await expect(result).rejects.toMatchObject({
        code: 'ESTATE_DEVELOPMENT_UNAVAILABLE',
        message: expect.stringContaining(text),
      });
      expect(repository.create).not.toHaveBeenCalled();
    },
  );

  it.each<RegistryStatus>(['archived', 'missing'])(
    'responsável %s bloqueia com OWNER_UNAVAILABLE',
    async (status) => {
      const { useCase, repository } = createScenario({ owner: status });

      await expect(
        useCase.execute(input({ ownerId: 'o-1' })),
      ).rejects.toBeInstanceOf(OwnerUnavailableError);
      expect(repository.create).not.toHaveBeenCalled();
    },
  );

  it('título inválido é recusado sem consultar nem gravar', async () => {
    const { useCase, repository, registryQueryRepository } = createScenario();

    await expect(
      useCase.execute(input({ title: '   ', ownerId: 'o-1' })),
    ).rejects.toBeInstanceOf(InvalidTitleError);
    expect(repository.create).not.toHaveBeenCalled();
    expect(registryQueryRepository.findOwnerStatus).not.toHaveBeenCalled();
  });

  it('descrição acima de 1200 é recusada', async () => {
    const { useCase, repository } = createScenario();

    await expect(
      useCase.execute(input({ description: 'a'.repeat(1201) })),
    ).rejects.toBeInstanceOf(InvalidDescriptionError);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('prazo que não é data existente vira INVALID_REQUEST (e não INVALID_DATE)', async () => {
    const { useCase, repository } = createScenario();

    const result = useCase.execute(input({ dueDate: '2026-02-30' }));

    await expect(result).rejects.toBeInstanceOf(InvalidDueDateError);
    await expect(result).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('falha ao gravar não loga sucesso', async () => {
    const { useCase, repository, logger } = createScenario();
    repository.create.mockRejectedValue(new Error('db down'));

    await expect(useCase.execute(input())).rejects.toThrow('db down');
    expect(logger.info).not.toHaveBeenCalled();
  });
});
