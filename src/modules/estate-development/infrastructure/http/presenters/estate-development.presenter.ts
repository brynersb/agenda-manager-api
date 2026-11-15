import type { EstateDevelopmentReadModel } from '@/modules/estate-development/application/interfaces/repositories/estate-development-query.repository.interface';
import type { EstateDevelopmentResponseDto } from '@/modules/estate-development/infrastructure/http/dtos/estate-development.response.dto';

export function toRegistryResponse(
  estateDevelopment: EstateDevelopmentReadModel,
): EstateDevelopmentResponseDto {
  return {
    id: estateDevelopment.id,
    name: estateDevelopment.name,
    active: estateDevelopment.active,
    version: estateDevelopment.version,
    openContentBriefs: estateDevelopment.openContentBriefs,
  };
}
