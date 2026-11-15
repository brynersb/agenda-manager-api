import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { EstateDevelopmentRepositoryInterface } from '@/modules/estate-development/application/interfaces/repositories/estate-development.repository.interface';
import type { EstateDevelopmentDomainEntity } from '@/modules/estate-development/domain/entities/estate-development.domain-entity';
import {
  EstateDevelopmentNameDuplicatedError,
  EstateDevelopmentVersionOutdatedError,
} from '@/modules/estate-development/domain/errors/estate-development.errors';
import { EstateDevelopmentEntity } from '@/modules/estate-development/infrastructure/persistence/entities/estate-development.entity';
import { EstateDevelopmentMapper } from '@/modules/estate-development/infrastructure/persistence/mappers/estate-development.mapper';
import { isUniqueViolation } from '@/shared/infrastructure/persistence/database-error.util';

const NAME_INDEX = 'ux_estate_developments_name';

@Injectable()
export class EstateDevelopmentRepository
  implements EstateDevelopmentRepositoryInterface
{
  constructor(
    @InjectRepository(EstateDevelopmentEntity)
    private readonly repository: Repository<EstateDevelopmentEntity>,
  ) {}

  async findById(id: string): Promise<EstateDevelopmentDomainEntity | null> {
    const entity = await this.repository.findOneBy({ id });
    return entity ? EstateDevelopmentMapper.toDomain(entity) : null;
  }

  async findByNormalizedName(
    normalizedName: string,
  ): Promise<EstateDevelopmentDomainEntity | null> {
    const entity = await this.repository.findOneBy({ normalizedName });
    return entity ? EstateDevelopmentMapper.toDomain(entity) : null;
  }

  async save(
    estateDevelopment: EstateDevelopmentDomainEntity,
    expectedVersion?: number,
  ): Promise<void> {
    const entity = EstateDevelopmentMapper.toEntity(estateDevelopment);
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
    entity: EstateDevelopmentEntity,
    expectedVersion: number,
  ): Promise<void> {
    const result = await this.repository
      .createQueryBuilder()
      .update(EstateDevelopmentEntity)
      .set({
        name: entity.name,
        normalizedName: entity.normalizedName,
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
      throw new EstateDevelopmentVersionOutdatedError();
    }
  }

  /** Corrida no índice único: descobre se o homônimo está arquivado. */
  private async buildNameDuplicatedError(
    normalizedName: string,
  ): Promise<EstateDevelopmentNameDuplicatedError> {
    const namesake = await this.findByNormalizedName(normalizedName);
    return new EstateDevelopmentNameDuplicatedError(
      namesake !== null && !namesake.active,
    );
  }
}
