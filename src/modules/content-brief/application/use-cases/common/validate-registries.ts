import type { RegistryQueryRepositoryInterface } from '@/modules/content-brief/application/interfaces/repositories/registry-query.repository.interface';
import {
  EstateDevelopmentUnavailableError,
  OwnerUnavailableError,
} from '@/modules/content-brief/domain/errors/content-brief.errors';

/**
 * Ids que estão sendo **atribuídos agora** (novos ou trocados); `null` não
 * valida nada. Quem mantém o cadastro já atribuído não passa o id aqui.
 */
export type AssignedRegistries = {
  estateDevelopmentId: string | null;
  ownerId: string | null;
};

/**
 * Garante que o empreendimento/responsável recém-atribuído existe e está
 * ativo (`ESTATE_DEVELOPMENT_UNAVAILABLE` / `OWNER_UNAVAILABLE`).
 */
export async function validateAssignedRegistries(
  registryQueryRepository: RegistryQueryRepositoryInterface,
  assigned: AssignedRegistries,
): Promise<void> {
  if (assigned.estateDevelopmentId !== null) {
    const status = await registryQueryRepository.findEstateDevelopmentStatus(
      assigned.estateDevelopmentId,
    );
    if (status !== 'active') {
      throw new EstateDevelopmentUnavailableError(status);
    }
  }
  if (assigned.ownerId !== null) {
    const status = await registryQueryRepository.findOwnerStatus(
      assigned.ownerId,
    );
    if (status !== 'active') {
      throw new OwnerUnavailableError(status);
    }
  }
}
