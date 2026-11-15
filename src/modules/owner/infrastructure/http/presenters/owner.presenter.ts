import type { OwnerReadModel } from '@/modules/owner/application/interfaces/repositories/owner-query.repository.interface';
import type { OwnerResponseDto } from '@/modules/owner/infrastructure/http/dtos/owner.response.dto';

export function toRegistryResponse(owner: OwnerReadModel): OwnerResponseDto {
  return {
    id: owner.id,
    name: owner.name,
    email: owner.email,
    active: owner.active,
    version: owner.version,
    openContentBriefs: owner.openContentBriefs,
  };
}
