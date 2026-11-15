import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import type { ContentBriefRepositoryInterface } from '@/modules/content-brief/application/interfaces/repositories/content-brief.repository.interface';
import type { ContentBriefDomainEntity } from '@/modules/content-brief/domain/entities/content-brief.domain-entity';
import {
  ContentBriefNotFoundError,
  ContentBriefVersionOutdatedError,
} from '@/modules/content-brief/domain/errors/content-brief.errors';
import { ContentBriefEntity } from '@/modules/content-brief/infrastructure/persistence/entities/content-brief.entity';
import { ContentBriefMapper } from '@/modules/content-brief/infrastructure/persistence/mappers/content-brief.mapper';

@Injectable()
export class ContentBriefRepository implements ContentBriefRepositoryInterface {
  constructor(
    @InjectRepository(ContentBriefEntity)
    private readonly repository: Repository<ContentBriefEntity>,
  ) {}

  async findById(id: string): Promise<ContentBriefDomainEntity | null> {
    const entity = await this.repository.findOneBy({ id, deletedAt: IsNull() });
    return entity ? ContentBriefMapper.toDomain(entity) : null;
  }

  async create(contentBrief: ContentBriefDomainEntity): Promise<void> {
    await this.repository.insert(ContentBriefMapper.toEntity(contentBrief));
  }

  /** `UPDATE ... WHERE version = expectedVersion`: o TypeORM soma 1 em `version`. */
  async update(
    contentBrief: ContentBriefDomainEntity,
    expectedVersion: number,
  ): Promise<void> {
    const entity = ContentBriefMapper.toEntity(contentBrief);
    const result = await this.repository
      .createQueryBuilder()
      .update(ContentBriefEntity)
      .set({
        title: entity.title,
        description: entity.description,
        dueDate: entity.dueDate,
        status: entity.status,
        action: entity.action,
        channel: entity.channel,
        estateDevelopmentId: entity.estateDevelopmentId,
        ownerId: entity.ownerId,
        completedAt: entity.completedAt,
        audit: {
          updatedAt: entity.audit.updatedAt,
          updatedBy: entity.audit.updatedBy,
          updatedByName: entity.audit.updatedByName,
        },
      })
      .where('id = :id AND version = :expectedVersion AND deleted_at IS NULL', {
        id: entity.id,
        expectedVersion,
      })
      .execute();

    if (!result.affected) {
      throw await this.resolveUpdateFailure(entity.id);
    }
  }

  async softDelete(contentBrief: ContentBriefDomainEntity): Promise<void> {
    const entity = ContentBriefMapper.toEntity(contentBrief);
    const result = await this.repository
      .createQueryBuilder()
      .update(ContentBriefEntity)
      .set({
        deletedAt: entity.deletedAt,
        deletedBy: entity.deletedBy,
        audit: {
          updatedAt: entity.audit.updatedAt,
          updatedBy: entity.audit.updatedBy,
          updatedByName: entity.audit.updatedByName,
        },
      })
      .where('id = :id AND deleted_at IS NULL', { id: entity.id })
      .execute();

    if (!result.affected) {
      throw new ContentBriefNotFoundError();
    }
  }

  /** Nenhuma linha atualizada: a pauta sumiu (404) ou a versão mudou (409). */
  private async resolveUpdateFailure(
    id: string,
  ): Promise<ContentBriefNotFoundError | ContentBriefVersionOutdatedError> {
    const current = await this.repository.findOneBy({
      id,
      deletedAt: IsNull(),
    });
    return current
      ? new ContentBriefVersionOutdatedError()
      : new ContentBriefNotFoundError();
  }
}
