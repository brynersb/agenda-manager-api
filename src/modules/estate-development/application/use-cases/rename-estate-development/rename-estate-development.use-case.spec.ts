import type { EstateDevelopmentRepositoryInterface } from '@/modules/estate-development/application/interfaces/repositories/estate-development.repository.interface';
import type { EstateDevelopmentQueryRepositoryInterface } from '@/modules/estate-development/application/interfaces/repositories/estate-development-query.repository.interface';
import { RenameEstateDevelopmentUseCase } from '@/modules/estate-development/application/use-cases/rename-estate-development/rename-estate-development.use-case';
import { EstateDevelopmentDomainEntity } from '@/modules/estate-development/domain/entities/estate-development.domain-entity';
import {
  EstateDevelopmentNameDuplicatedError,
  EstateDevelopmentNotFoundError,
  EstateDevelopmentVersionOutdatedError,
} from '@/modules/estate-development/domain/errors/estate-development.errors';
import type { ClockInterface } from '@/shared/application/interfaces/clock.interface';
import type { LoggerServiceInterface } from '@/shared/application/interfaces/logger.service.interface';
import { newAudit } from '@/shared/domain/audit';
import {
  InvalidRegistryNameError,
  RegistryName,
} from '@/shared/domain/registry-name';

const actor = { id: 'u-2', name: 'Bia' };
const NOW = new Date('2026-11-14T12:00:00Z');
const fixedClock: ClockInterface = { now: () => NOW, today: vi.fn() };

function existing(id = 'e-1', name = 'Bela Vista', active = true, version = 3) {
  return EstateDevelopmentDomainEntity.restore({
    id,
    name: RegistryName.create(name),
    active,
    version,
    audit: newAudit({ id: 'u-1', name: 'Ana' }, new Date()),
  });
}

function createScenario() {
  const repository = {
    findById: vi.fn().mockResolvedValue(existing()),
    findByNormalizedName: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
  } satisfies EstateDevelopmentRepositoryInterface;
  const queryRepository = {
    findAll: vi.fn(),
    findOneById: vi.fn().mockResolvedValue({
      id: 'e-1',
      name: 'Vila Nova',
      active: true,
      version: 4,
      openContentBriefs: 0,
    }),
  } satisfies EstateDevelopmentQueryRepositoryInterface;
  const logger = {
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    setLogPrefix: vi.fn(),
  } satisfies LoggerServiceInterface;
  const useCase = new RenameEstateDevelopmentUseCase(
    repository,
    queryRepository,
    fixedClock,
    logger,
  );
  return { useCase, repository, queryRepository, logger };
}

describe('RenameEstateDevelopmentUseCase', () => {
  it('renomeia, grava com a versão esperada e devolve o read model', async () => {
    const { useCase, repository, logger } = createScenario();

    const result = await useCase.execute({
      id: 'e-1',
      name: ' Vila   Nova ',
      version: 3,
      actor,
    });

    const [saved, expectedVersion] = repository.save.mock.calls[0];
    expect(saved.name.value).toBe('Vila Nova');
    expect(saved.audit).toMatchObject({ updatedBy: 'u-2' });
    expect(expectedVersion).toBe(3);
    expect(result).toMatchObject({ id: 'e-1', version: 4 });
    expect(logger.info).toHaveBeenCalledWith(
      'Empreendimento renomeado',
      expect.objectContaining({
        'evt.name': 'estate_development.renamed',
        outcome: 'success',
        estate_development_id: 'e-1',
      }),
    );
  });

  it('permite mudar só caixa e acento do próprio nome', async () => {
    const { useCase, repository } = createScenario();
    repository.findByNormalizedName.mockResolvedValue(existing());

    await useCase.execute({ id: 'e-1', name: 'BELA VISTA', version: 3, actor });

    expect(repository.save).toHaveBeenCalledTimes(1);
  });

  it('recusa nome inválido', async () => {
    const { useCase, repository } = createScenario();

    await expect(
      useCase.execute({ id: 'e-1', name: '', version: 3, actor }),
    ).rejects.toBeInstanceOf(InvalidRegistryNameError);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('não encontrado', async () => {
    const { useCase, repository } = createScenario();
    repository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ id: 'x', name: 'Novo', version: 1, actor }),
    ).rejects.toBeInstanceOf(EstateDevelopmentNotFoundError);
  });

  it('versão desatualizada', async () => {
    const { useCase, repository } = createScenario();

    await expect(
      useCase.execute({ id: 'e-1', name: 'Novo', version: 2, actor }),
    ).rejects.toBeInstanceOf(EstateDevelopmentVersionOutdatedError);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('nome de outro empreendimento ativo: duplicado, com log blocked', async () => {
    const { useCase, repository, logger } = createScenario();
    repository.findByNormalizedName.mockResolvedValue(
      existing('e-2', 'Vila Nova'),
    );

    await expect(
      useCase.execute({ id: 'e-1', name: 'vila nova', version: 3, actor }),
    ).rejects.toMatchObject({
      code: 'ESTATE_DEVELOPMENT_NAME_DUPLICATED',
      message: 'Já existe um empreendimento com este nome.',
    });
    expect(repository.save).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        'evt.name': 'estate_development.renamed',
        outcome: 'blocked',
        estate_development_id: 'e-1',
      }),
    );
  });

  it('nome de outro empreendimento arquivado: mensagem orienta a reativar', async () => {
    const { useCase, repository } = createScenario();
    repository.findByNormalizedName.mockResolvedValue(
      existing('e-2', 'Vila Nova', false),
    );

    await expect(
      useCase.execute({ id: 'e-1', name: 'Vila Nova', version: 3, actor }),
    ).rejects.toMatchObject({
      message:
        'Já existe um empreendimento arquivado com este nome. Reative-o em vez de criar outro.',
    });
  });

  it('corrida: duplicado vindo do repositório é propagado e logado', async () => {
    const { useCase, repository, logger } = createScenario();
    repository.save.mockRejectedValue(
      new EstateDevelopmentNameDuplicatedError(),
    );

    await expect(
      useCase.execute({ id: 'e-1', name: 'Vila Nova', version: 3, actor }),
    ).rejects.toBeInstanceOf(EstateDevelopmentNameDuplicatedError);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ outcome: 'blocked' }),
    );
  });

  it('corrida: versão desatualizada vinda do repositório é propagada', async () => {
    const { useCase, repository, logger } = createScenario();
    repository.save.mockRejectedValue(
      new EstateDevelopmentVersionOutdatedError(),
    );

    await expect(
      useCase.execute({ id: 'e-1', name: 'Vila Nova', version: 3, actor }),
    ).rejects.toBeInstanceOf(EstateDevelopmentVersionOutdatedError);
    expect(logger.info).not.toHaveBeenCalled();
  });
});
