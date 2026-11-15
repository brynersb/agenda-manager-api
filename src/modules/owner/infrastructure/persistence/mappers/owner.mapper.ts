import { OwnerDomainEntity } from '@/modules/owner/domain/entities/owner.domain-entity';
import { Email } from '@/modules/owner/domain/value-objects/email';
import { OwnerEntity } from '@/modules/owner/infrastructure/persistence/entities/owner.entity';
import { RegistryName } from '@/shared/domain/registry-name';
import { AuditColumns } from '@/shared/infrastructure/persistence/audit.columns';

/** Converte `entity <-> entidade de domínio`; a auditoria vem do domínio, não do ORM. */
export const OwnerMapper = {
  toDomain(entity: OwnerEntity): OwnerDomainEntity {
    return OwnerDomainEntity.restore({
      id: entity.id,
      name: RegistryName.restore(entity.name),
      email: entity.email === null ? null : Email.restore(entity.email),
      keycloakUserId: entity.keycloakUserId,
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

  toEntity(owner: OwnerDomainEntity): OwnerEntity {
    const entity = new OwnerEntity();
    entity.id = owner.id;
    entity.name = owner.name.value;
    entity.normalizedName = owner.name.normalized;
    entity.email = owner.email?.value ?? null;
    entity.keycloakUserId = owner.keycloakUserId;
    entity.active = owner.active;
    entity.version = owner.version;
    const audit = new AuditColumns();
    audit.createdAt = owner.audit.createdAt;
    audit.createdBy = owner.audit.createdBy;
    audit.createdByName = owner.audit.createdByName;
    audit.updatedAt = owner.audit.updatedAt;
    audit.updatedBy = owner.audit.updatedBy;
    audit.updatedByName = owner.audit.updatedByName;
    entity.audit = audit;
    return entity;
  },
};
