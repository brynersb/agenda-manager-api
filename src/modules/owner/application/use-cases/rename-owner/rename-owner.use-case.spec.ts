import type { OwnerRepositoryInterface } from '@/modules/owner/application/interfaces/repositories/owner.repository.interface';
import type { OwnerQueryRepositoryInterface } from '@/modules/owner/application/interfaces/repositories/owner-query.repository.interface';
import { RenameOwnerUseCase } from '@/modules/owner/application/use-cases/rename-owner/rename-owner.use-case';
import { OwnerDomainEntity } from '@/modules/owner/domain/entities/owner.domain-entity';
import {
  OwnerNameDuplicatedError,
  OwnerNotFoundError,
  OwnerVersionOutdatedError,
} from '@/modules/owner/domain/errors/owner.errors';
import {
  Email,
  InvalidEmailError,
} from '@/modules/owner/domain/value-objects/email';
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
  return OwnerDomainEntity.restore({
    id,
    name: RegistryName.create(name),
    email: Email.restore('antigo@bora.com'),
    keycloakUserId: null,
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
  } satisfies OwnerRepositoryInterface;
  const queryRepository = {
    findAll: vi.fn(),
    findOneById: vi.fn().mockResolvedValue({
      id: 'e-1',
      name: 'Vila Nova',
      email: null,
      active: true,
      version: 4,
      openContentBriefs: 0,
    }),
  } satisfies OwnerQueryRepositoryInterface;
  const logger = {
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    setLogPrefix: vi.fn(),
  } satisfies LoggerServiceInterface;
  const useCase = new RenameOwnerUseCase(
    repository,
    queryRepository,
    fixedClock,
    logger,
  );
  return { useCase, repository, queryRepository, logger };
}

describe('RenameOwnerUseCase', () => {
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
      'Responsável renomeado',
      expect.objectContaining({
        'evt.name': 'owner.renamed',
        outcome: 'success',
        owner_id: 'e-1',
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
    ).rejects.toBeInstanceOf(OwnerNotFoundError);
  });

  it('versão desatualizada', async () => {
    const { useCase, repository } = createScenario();

    await expect(
      useCase.execute({ id: 'e-1', name: 'Novo', version: 2, actor }),
    ).rejects.toBeInstanceOf(OwnerVersionOutdatedError);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('nome de outro responsável ativo: duplicado, com log blocked', async () => {
    const { useCase, repository, logger } = createScenario();
    repository.findByNormalizedName.mockResolvedValue(
      existing('e-2', 'Vila Nova'),
    );

    await expect(
      useCase.execute({ id: 'e-1', name: 'vila nova', version: 3, actor }),
    ).rejects.toMatchObject({
      code: 'OWNER_NAME_DUPLICATED',
      message: 'Já existe um responsável com este nome.',
    });
    expect(repository.save).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        'evt.name': 'owner.renamed',
        outcome: 'blocked',
        owner_id: 'e-1',
      }),
    );
  });

  it('nome de outro responsável arquivado: mensagem orienta a reativar', async () => {
    const { useCase, repository } = createScenario();
    repository.findByNormalizedName.mockResolvedValue(
      existing('e-2', 'Vila Nova', false),
    );

    await expect(
      useCase.execute({ id: 'e-1', name: 'Vila Nova', version: 3, actor }),
    ).rejects.toMatchObject({
      message:
        'Já existe um responsável arquivado com este nome. Reative-o em vez de criar outro.',
    });
  });

  it('corrida: duplicado vindo do repositório é propagado e logado', async () => {
    const { useCase, repository, logger } = createScenario();
    repository.save.mockRejectedValue(new OwnerNameDuplicatedError());

    await expect(
      useCase.execute({ id: 'e-1', name: 'Vila Nova', version: 3, actor }),
    ).rejects.toBeInstanceOf(OwnerNameDuplicatedError);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ outcome: 'blocked' }),
    );
  });

  it('corrida: versão desatualizada vinda do repositório é propagada', async () => {
    const { useCase, repository, logger } = createScenario();
    repository.save.mockRejectedValue(new OwnerVersionOutdatedError());

    await expect(
      useCase.execute({ id: 'e-1', name: 'Vila Nova', version: 3, actor }),
    ).rejects.toBeInstanceOf(OwnerVersionOutdatedError);
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('sem e-mail no pedido, mantém o atual', async () => {
    const { useCase, repository } = createScenario();

    await useCase.execute({ id: 'e-1', name: 'Vila Nova', version: 3, actor });

    expect(repository.save.mock.calls[0][0].email?.value).toBe(
      'antigo@bora.com',
    );
  });

  it('com e-mail no pedido, troca o e-mail', async () => {
    const { useCase, repository } = createScenario();

    await useCase.execute({
      id: 'e-1',
      name: 'Vila Nova',
      email: ' novo@bora.com ',
      version: 3,
      actor,
    });

    expect(repository.save.mock.calls[0][0].email?.value).toBe('novo@bora.com');
  });

  it.each([null, '  '])('e-mail %j remove o e-mail', async (email) => {
    const { useCase, repository } = createScenario();

    await useCase.execute({
      id: 'e-1',
      name: 'Vila Nova',
      email,
      version: 3,
      actor,
    });

    expect(repository.save.mock.calls[0][0].email).toBeNull();
  });

  it('e-mail inválido é recusado sem gravar', async () => {
    const { useCase, repository } = createScenario();

    await expect(
      useCase.execute({
        id: 'e-1',
        name: 'Vila Nova',
        email: 'invalid',
        version: 3,
        actor,
      }),
    ).rejects.toBeInstanceOf(InvalidEmailError);
    expect(repository.save).not.toHaveBeenCalled();
  });
});
