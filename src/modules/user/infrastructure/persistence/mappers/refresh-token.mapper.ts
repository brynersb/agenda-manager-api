import { RefreshTokenDomainEntity } from '@/modules/user/domain/entities/refresh-token.domain-entity';
import { RefreshTokenEntity } from '@/modules/user/infrastructure/persistence/entities/refresh-token.entity';

export const RefreshTokenMapper = {
  toDomain(entity: RefreshTokenEntity): RefreshTokenDomainEntity {
    return RefreshTokenDomainEntity.restore({
      id: entity.id,
      userId: entity.userId,
      familyId: entity.familyId,
      tokenHash: entity.tokenHash,
      expiresAt: entity.expiresAt,
      revokedAt: entity.revokedAt,
      replacedById: entity.replacedById,
      createdAt: entity.createdAt,
      userAgent: entity.userAgent,
      ip: entity.ip,
    });
  },

  toEntity(token: RefreshTokenDomainEntity): RefreshTokenEntity {
    const entity = new RefreshTokenEntity();
    entity.id = token.id;
    entity.userId = token.userId;
    entity.familyId = token.familyId;
    entity.tokenHash = token.tokenHash;
    entity.expiresAt = token.expiresAt;
    entity.revokedAt = token.revokedAt;
    entity.replacedById = token.replacedById;
    entity.createdAt = token.createdAt;
    entity.userAgent = token.userAgent;
    entity.ip = token.ip;
    return entity;
  },
};
