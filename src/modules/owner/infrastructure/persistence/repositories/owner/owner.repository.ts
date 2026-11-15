import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { OwnerRepositoryInterface } from '@/modules/owner/application/interfaces/repositories/owner.repository.interface';
import type { OwnerDomainEntity } from '@/modules/owner/domain/entities/owner.domain-entity';
import {
  OwnerNameDuplicatedError,
  OwnerVersionOutdatedError,
} from '@/modules/owner/domain/errors/owner.errors';
import { OwnerEntity } from '@/modules/owner/infrastructure/persistence/entities/owner.entity';
import { OwnerMapper } from '@/modules/owner/infrastructure/persistence/mappers/owner.mapper';
import { isUniqueViolation } from '@/shared/infrastructure/persistence/database-error.util';

const NAME_INDEX = 'ux_owners_name';

@Injectable()
export class OwnerRepository implements OwnerRepositoryInterface {
  constructor(
    @InjectRepository(OwnerEntity)
    private readonly repository: Repository<OwnerEntity>,
  ) {}

  async findById(id: string): Promise<OwnerDomainEntity | null> {
    const entity = await this.repository.findOneBy({ id });
    return entity ? OwnerMapper.toDomain(entity) : null;
  }

  async findByNormalizedName(
    normalizedName: string,
  ): Promise<OwnerDomainEntity | null> {
    const entity = await this.repository.findOneBy({ normalizedName });
    return entity ? OwnerMapper.toDomain(entity) : null;
  }

  async save(
    owner: OwnerDomainEntity,
    expectedVersion?: number,
  ): Promise<void> {
    const entity = OwnerMapper.toEntity(owner);
    try {
      if (expectedVersion === undefined) {
        await this.repository.insert(entity);
        return;
      }
      await this.updateWithVersionCheck(entity, expectedVersion);
    } catch (error) {
      if (isUniqueViolation(error, NAME_INDEX)) {
        throw await this.buildNameDuplicatedError(entity.normalizedName);
      }
      throw error;
    }
  }

  /** `UPDATE ... WHERE version = esperada`: o TypeORM soma 1 em `version`. */
  private async updateWithVersionCheck(
    entity: OwnerEntity,
    expectedVersion: number,
  ): Promise<void> {
    const result = await this.repository
      .createQueryBuilder()
      .update(OwnerEntity)
      .set({
        name: entity.name,
        normalizedName: entity.normalizedName,
        email: entity.email,
        active: entity.active,
        audit: {
          updatedAt: entity.audit.updatedAt,
          updatedBy: entity.audit.updatedBy,
          updatedByName: entity.audit.updatedByName,
        },
      })
      .where('id = :id AND version = :expectedVersion', {
        id: entity.id,
        expectedVersion,
      })
      .execute();

    if (!result.affected) {
      throw new OwnerVersionOutdatedError();
    }
  }

  /** Corrida no índice único: descobre se o homônimo está arquivado. */
  private async buildNameDuplicatedError(
    normalizedName: string,
  ): Promise<OwnerNameDuplicatedError> {
    const namesake = await this.findByNormalizedName(normalizedName);
    return new OwnerNameDuplicatedError(namesake !== null && !namesake.active);
  }
}
