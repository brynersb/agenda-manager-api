import type { OwnerRepositoryInterface } from '@/modules/owner/application/interfaces/repositories/owner.repository.interface';
import type { OwnerQueryRepositoryInterface } from '@/modules/owner/application/interfaces/repositories/owner-query.repository.interface';
import { CreateOwnerUseCase } from '@/modules/owner/application/use-cases/create-owner/create-owner.use-case';
import { OwnerDomainEntity } from '@/modules/owner/domain/entities/owner.domain-entity';
import { OwnerNameDuplicatedError } from '@/modules/owner/domain/errors/owner.errors';
import { InvalidEmailError } from '@/modules/owner/domain/value-objects/email';
import type { ClockInterface } from '@/shared/application/interfaces/clock.interface';
import type { LoggerServiceInterface } from '@/shared/application/interfaces/logger.service.interface';
import {
  InvalidRegistryNameError,
  RegistryName,
} from '@/shared/domain/registry-name';

const actor = { id: 'u-1', name: 'Ana' };
const NOW = new Date('2026-11-14T12:00:00Z');
const fixedClock: ClockInterface = { now: () => NOW, today: vi.fn() };

function createScenario() {
  const repository = {
    findById: vi.fn(),
    findByNormalizedName: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
  } satisfies OwnerRepositoryInterface;
  const queryRepository = {
    findAll: vi.fn(),
    findOneById: vi.fn(),
  } satisfies OwnerQueryRepositoryInterface;
  const logger = {
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    setLogPrefix: vi.fn(),
  } satisfies LoggerServiceInterface;
  queryRepository.findOneById.mockImplementation(async (id: string) => ({
    id,
    name: 'Ana Souza',
    email: null,
    active: true,
    version: 1,
    openContentBriefs: 0,
  }));
  const useCase = new CreateOwnerUseCase(
    repository,
    queryRepository,
    fixedClock,
    logger,
  );
  return { useCase, repository, queryRepository, logger, clock: fixedClock };
}

describe('CreateOwnerUseCase', () => {
  it('cria, grava com auditoria do ator e devolve o read model', async () => {
    const { useCase, repository, logger, clock } = createScenario();

    const result = await useCase.execute({
      name: '  Ana   Souza ',
      actor,
    });

    expect(repository.findByNormalizedName).toHaveBeenCalledWith('ana souza');
    expect(repository.save).toHaveBeenCalledTimes(1);
    const [saved, expectedVersion] = repository.save.mock.calls[0];
    expect(expectedVersion).toBeUndefined();
    expect(saved.name.value).toBe('Ana Souza');
    expect(saved.active).toBe(true);
    expect(saved.audit).toMatchObject({
      createdBy: 'u-1',
      createdByName: 'Ana',
      createdAt: clock.now(),
    });
    expect(result).toMatchObject({ id: saved.id, openContentBriefs: 0 });
    expect(logger.info).toHaveBeenCalledWith(
      'Responsável criado',
      expect.objectContaining({
        'evt.name': 'owner.created',
        outcome: 'success',
        owner_id: saved.id,
        user_sub: 'u-1',
      }),
    );
  });

  it('recusa nome inválido sem consultar nem gravar', async () => {
    const { useCase, repository } = createScenario();

    await expect(
      useCase.execute({ name: '   ', actor }),
    ).rejects.toBeInstanceOf(InvalidRegistryNameError);
    expect(repository.findByNormalizedName).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('bloqueia homônimo ativo com a mensagem padrão e log blocked', async () => {
    const { useCase, repository, logger } = createScenario();
    repository.findByNormalizedName.mockResolvedValue(
      OwnerDomainEntity.create(
        { name: RegistryName.create('Ana Souza') },
        actor,
        new Date(),
      ),
    );

    const error = await useCase
      .execute({ name: 'ana souza', actor })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(OwnerNameDuplicatedError);
    expect(error).toMatchObject({
      code: 'OWNER_NAME_DUPLICATED',
      message: 'Já existe um responsável com este nome.',
    });
    expect(repository.save).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        'evt.name': 'owner.created',
        outcome: 'blocked',
      }),
    );
  });

  it('com homônimo arquivado, a mensagem orienta a reativar', async () => {
    const { useCase, repository } = createScenario();
    const archived = OwnerDomainEntity.create(
      { name: RegistryName.create('Bela Vista') },
      actor,
      new Date(),
    );
    archived.archive(actor, new Date());
    repository.findByNormalizedName.mockResolvedValue(archived);

    await expect(
      useCase.execute({ name: 'Bela Vista', actor }),
    ).rejects.toMatchObject({
      code: 'OWNER_NAME_DUPLICATED',
      message:
        'Já existe um responsável arquivado com este nome. Reative-o em vez de criar outro.',
    });
  });

  it('corrida: duplicado vindo do repositório é propagado e logado como blocked', async () => {
    const { useCase, repository, logger } = createScenario();
    repository.save.mockRejectedValue(new OwnerNameDuplicatedError());

    await expect(
      useCase.execute({ name: 'Bela Vista', actor }),
    ).rejects.toBeInstanceOf(OwnerNameDuplicatedError);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ outcome: 'blocked' }),
    );
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('propaga erro inesperado do repositório sem logar duplicado', async () => {
    const { useCase, repository, logger } = createScenario();
    repository.save.mockRejectedValue(new Error('banco fora'));

    await expect(useCase.execute({ name: 'X', actor })).rejects.toThrow(
      'banco fora',
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('grava o e-mail informado, sem espaços nas pontas', async () => {
    const { useCase, repository } = createScenario();

    await useCase.execute({ name: 'Ana', email: ' ana@bora.com ', actor });

    expect(repository.save.mock.calls[0][0].email?.value).toBe('ana@bora.com');
  });

  it('e-mail ausente, nulo ou em branco significa sem e-mail', async () => {
    const { useCase, repository } = createScenario();

    await useCase.execute({ name: 'Ana', actor });
    await useCase.execute({ name: 'Bia', email: null, actor });
    await useCase.execute({ name: 'Cris', email: '  ', actor });

    for (const [saved] of repository.save.mock.calls) {
      expect(saved.email).toBeNull();
    }
  });

  it('e-mail inválido é recusado sem consultar nem gravar', async () => {
    const { useCase, repository } = createScenario();

    await expect(
      useCase.execute({ name: 'Ana', email: 'sem-arroba', actor }),
    ).rejects.toBeInstanceOf(InvalidEmailError);
    expect(repository.findByNormalizedName).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });
});
