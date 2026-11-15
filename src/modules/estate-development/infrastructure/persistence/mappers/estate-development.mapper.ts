import { EstateDevelopmentDomainEntity } from '@/modules/estate-development/domain/entities/estate-development.domain-entity';
import { EstateDevelopmentEntity } from '@/modules/estate-development/infrastructure/persistence/entities/estate-development.entity';
import { RegistryName } from '@/shared/domain/registry-name';
import { AuditColumns } from '@/shared/infrastructure/persistence/audit.columns';

/** Converte `entity <-> entidade de domínio`; a auditoria vem do domínio, não do ORM. */
export const EstateDevelopmentMapper = {
  toDomain(entity: EstateDevelopmentEntity): EstateDevelopmentDomainEntity {
    return EstateDevelopmentDomainEntity.restore({
      id: entity.id,
      name: RegistryName.restore(entity.name),
      active: entity.active,
      version: entity.version,
      audit: {
        createdAt: entity.audit.createdAt,
        createdBy: entity.audit.createdBy,
        createdByName: entity.audit.createdByName,
        updatedAt: entity.audit.updatedAt,
        updatedBy: entity.audit.updatedBy,
        updatedByName: entity.audit.updatedByName,
      },
    });
  },

  toEntity(
    estateDevelopment: EstateDevelopmentDomainEntity,
  ): EstateDevelopmentEntity {
    const entity = new EstateDevelopmentEntity();
    entity.id = estateDevelopment.id;
    entity.name = estateDevelopment.name.value;
    entity.normalizedName = estateDevelopment.name.normalized;
    entity.active = estateDevelopment.active;
    entity.version = estateDevelopment.version;
    const audit = new AuditColumns();
    audit.createdAt = estateDevelopment.audit.createdAt;
    audit.createdBy = estateDevelopment.audit.createdBy;
    audit.createdByName = estateDevelopment.audit.createdByName;
    audit.updatedAt = estateDevelopment.audit.updatedAt;
    audit.updatedBy = estateDevelopment.audit.updatedBy;
    audit.updatedByName = estateDevelopment.audit.updatedByName;
    entity.audit = audit;
    return entity;
  },
};
