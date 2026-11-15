import { UserDomainEntity } from '@/modules/user/domain/entities/user.domain-entity';
import { UserEmail } from '@/modules/user/domain/value-objects/user-email';
import { UserName } from '@/modules/user/domain/value-objects/user-name';
import { UserEntity } from '@/modules/user/infrastructure/persistence/entities/user.entity';
import { AuditColumns } from '@/shared/infrastructure/persistence/audit.columns';

/** Converte `entity <-> entidade de domínio`; a auditoria vem do domínio, não do ORM. */
export const UserMapper = {
  toDomain(entity: UserEntity): UserDomainEntity {
    return UserDomainEntity.restore({
      id: entity.id,
      name: UserName.restore(entity.name),
      email: UserEmail.restore(entity.email),
      role: entity.role,
      status: entity.status,
      passwordHash: entity.passwordHash,
      mustChangePassword: entity.mustChangePassword,
      failedLoginAttempts: entity.failedLoginAttempts,
      lockedUntil: entity.lockedUntil,
      lastLoginAt: entity.lastLoginAt,
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

  toEntity(user: UserDomainEntity): UserEntity {
    const entity = new UserEntity();
    entity.id = user.id;
    entity.name = user.name.value;
    entity.email = user.email.value;
    entity.role = user.role;
    entity.status = user.status;
    entity.passwordHash = user.passwordHash;
    entity.mustChangePassword = user.mustChangePassword;
    entity.failedLoginAttempts = user.failedLoginAttempts;
    entity.lockedUntil = user.lockedUntil;
    entity.lastLoginAt = user.lastLoginAt;
    entity.version = user.version;
    const audit = new AuditColumns();
    audit.createdAt = user.audit.createdAt;
    audit.createdBy = user.audit.createdBy;
    audit.createdByName = user.audit.createdByName;
    audit.updatedAt = user.audit.updatedAt;
    audit.updatedBy = user.audit.updatedBy;
    audit.updatedByName = user.audit.updatedByName;
    entity.audit = audit;
    return entity;
  },
};
