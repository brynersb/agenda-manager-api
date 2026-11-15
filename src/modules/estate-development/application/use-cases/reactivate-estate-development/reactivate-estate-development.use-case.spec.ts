import type { EstateDevelopmentRepositoryInterface } from '@/modules/estate-development/application/interfaces/repositories/estate-development.repository.interface';
import type { EstateDevelopmentQueryRepositoryInterface } from '@/modules/estate-development/application/interfaces/repositories/estate-development-query.repository.interface';
import { ReactivateEstateDevelopmentUseCase } from '@/modules/estate-development/application/use-cases/reactivate-estate-development/reactivate-estate-development.use-case';
import { EstateDevelopmentDomainEntity } from '@/modules/estate-development/domain/entities/estate-development.domain-entity';
import {
  EstateDevelopmentNotFoundError,
  EstateDevelopmentVersionOutdatedError,
} from '@/modules/estate-development/domain/errors/estate-development.errors';
import type { ClockInterface } from '@/shared/application/interfaces/clock.interface';
import type { LoggerServiceInterface } from '@/shared/application/interfaces/logger.service.interface';
import { newAudit } from '@/shared/domain/audit';
import { RegistryName } from '@/shared/domain/registry-name';

const actor = { id: 'u-2', name: 'Bia' };
const NOW = new Date('2026-11-14T12:00:00Z');
const fixedClock: ClockInterface = { now: () => NOW, today: vi.fn() };

function existing(active: boolean) {
  return EstateDevelopmentDomainEntity.restore({
    id: 'e-1',
    name: RegistryName.create('Bela Vista'),
    active,
    version: 5,
    audit: newAudit({ id: 'u-1', name: 'Ana' }, new Date()),
  });
}

function createScenario(active: boolean) {
  const repository = {
    findById: vi.fn().mockResolvedValue(existing(active)),
    findByNormalizedName: vi.fn(),
    save: vi.fn().mockResolvedValue(undefined),
  } satisfies EstateDevelopmentRepositoryInterface;
  const queryRepository = {
    findAll: vi.fn(),
    findOneById: vi.fn().mockResolvedValue({
      id: 'e-1',
      name: 'Bela Vista',
      active: !active,
      version: 6,
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
  const useCase = new ReactivateEstateDevelopmentUseCase(
    repository,
    queryRepository,
    fixedClock,
    logger,
  );
  return { useCase, repository, queryRepository, logger };
}

describe('ReactivateEstateDevelopmentUseCase', () => {
  it('reativar um empreendimento arquivado, grava com a versão lida e loga', async () => {
    const { useCase, repository, logger } = createScenario(false);

    const result = await useCase.execute({ id: 'e-1', actor });

    const [saved, expectedVersion] = repository.save.mock.calls[0];
    expect(saved.active).toBe(true);
    expect(saved.audit).toMatchObject({ updatedBy: 'u-2' });
    expect(expectedVersion).toBe(5);
    expect(result).toMatchObject({ id: 'e-1', version: 6 });
    expect(logger.info).toHaveBeenCalledWith(
      'Empreendimento reativado',
      expect.objectContaining({
        'evt.name': 'estate_development.reactivated',
        outcome: 'success',
        estate_development_id: 'e-1',
        user_sub: 'u-2',
      }),
    );
  });

  it('é idempotente: já no estado pedido, não grava e loga skipped', async () => {
    const { useCase, repository, queryRepository, logger } =
      createScenario(true);

    const result = await useCase.execute({ id: 'e-1', actor });

    expect(repository.save).not.toHaveBeenCalled();
    expect(queryRepository.findOneById).toHaveBeenCalledWith('e-1');
    expect(result.id).toBe('e-1');
    expect(logger.info).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        'evt.name': 'estate_development.reactivated',
        outcome: 'skipped',
      }),
    );
  });

  it('não encontrado', async () => {
    const { useCase, repository } = createScenario(false);
    repository.findById.mockResolvedValue(null);

    await expect(useCase.execute({ id: 'x', actor })).rejects.toBeInstanceOf(
      EstateDevelopmentNotFoundError,
    );
  });

  it('alteração concorrente: propaga a versão desatualizada do repositório', async () => {
    const { useCase, repository } = createScenario(false);
    repository.save.mockRejectedValue(
      new EstateDevelopmentVersionOutdatedError(),
    );

    await expect(useCase.execute({ id: 'e-1', actor })).rejects.toBeInstanceOf(
      EstateDevelopmentVersionOutdatedError,
    );
  });
});
