import type { EstateDevelopmentRepositoryInterface } from '@/modules/estate-development/application/interfaces/repositories/estate-development.repository.interface';
import type { EstateDevelopmentQueryRepositoryInterface } from '@/modules/estate-development/application/interfaces/repositories/estate-development-query.repository.interface';
import { CreateEstateDevelopmentUseCase } from '@/modules/estate-development/application/use-cases/create-estate-development/create-estate-development.use-case';
import { EstateDevelopmentDomainEntity } from '@/modules/estate-development/domain/entities/estate-development.domain-entity';
import { EstateDevelopmentNameDuplicatedError } from '@/modules/estate-development/domain/errors/estate-development.errors';
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
  } satisfies EstateDevelopmentRepositoryInterface;
  const queryRepository = {
    findAll: vi.fn(),
    findOneById: vi.fn(),
  } satisfies EstateDevelopmentQueryRepositoryInterface;
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
    name: 'Residencial Ipê',
    active: true,
    version: 1,
    openContentBriefs: 0,
  }));
  const useCase = new CreateEstateDevelopmentUseCase(
    repository,
    queryRepository,
    fixedClock,
    logger,
  );
  return { useCase, repository, queryRepository, logger, clock: fixedClock };
}

describe('CreateEstateDevelopmentUseCase', () => {
  it('cria, grava com auditoria do ator e devolve o read model', async () => {
    const { useCase, repository, logger, clock } = createScenario();

    const result = await useCase.execute({
      name: '  Residencial   Ipê ',
      actor,
    });

    expect(repository.findByNormalizedName).toHaveBeenCalledWith(
      'residencial ipe',
    );
    expect(repository.save).toHaveBeenCalledTimes(1);
    const [saved, expectedVersion] = repository.save.mock.calls[0];
    expect(expectedVersion).toBeUndefined();
    expect(saved.name.value).toBe('Residencial Ipê');
    expect(saved.active).toBe(true);
    expect(saved.audit).toMatchObject({
      createdBy: 'u-1',
      createdByName: 'Ana',
      createdAt: clock.now(),
    });
    expect(result).toMatchObject({ id: saved.id, openContentBriefs: 0 });
    expect(logger.info).toHaveBeenCalledWith(
      'Empreendimento criado',
      expect.objectContaining({
        'evt.name': 'estate_development.created',
        outcome: 'success',
        estate_development_id: saved.id,
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
      EstateDevelopmentDomainEntity.create(
        { name: RegistryName.create('Residencial Ipê') },
        actor,
        new Date(),
      ),
    );

    const error = await useCase
      .execute({ name: 'residencial ipe', actor })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(EstateDevelopmentNameDuplicatedError);
    expect(error).toMatchObject({
      code: 'ESTATE_DEVELOPMENT_NAME_DUPLICATED',
      message: 'Já existe um empreendimento com este nome.',
    });
    expect(repository.save).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        'evt.name': 'estate_development.created',
        outcome: 'blocked',
      }),
    );
  });

  it('com homônimo arquivado, a mensagem orienta a reativar', async () => {
    const { useCase, repository } = createScenario();
    const archived = EstateDevelopmentDomainEntity.create(
      { name: RegistryName.create('Bela Vista') },
      actor,
      new Date(),
    );
    archived.archive(actor, new Date());
    repository.findByNormalizedName.mockResolvedValue(archived);

    await expect(
      useCase.execute({ name: 'Bela Vista', actor }),
    ).rejects.toMatchObject({
      code: 'ESTATE_DEVELOPMENT_NAME_DUPLICATED',
      message:
        'Já existe um empreendimento arquivado com este nome. Reative-o em vez de criar outro.',
    });
  });

  it('corrida: duplicado vindo do repositório é propagado e logado como blocked', async () => {
    const { useCase, repository, logger } = createScenario();
    repository.save.mockRejectedValue(
      new EstateDevelopmentNameDuplicatedError(),
    );

    await expect(
      useCase.execute({ name: 'Bela Vista', actor }),
    ).rejects.toBeInstanceOf(EstateDevelopmentNameDuplicatedError);
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
});
