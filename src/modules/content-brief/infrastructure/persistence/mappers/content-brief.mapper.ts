import { ContentBriefDomainEntity } from '@/modules/content-brief/domain/entities/content-brief.domain-entity';
import { Description } from '@/modules/content-brief/domain/value-objects/description';
import { Title } from '@/modules/content-brief/domain/value-objects/title';
import { ContentBriefEntity } from '@/modules/content-brief/infrastructure/persistence/entities/content-brief.entity';
import { CalendarDate } from '@/shared/domain/calendar-date';
import { AuditColumns } from '@/shared/infrastructure/persistence/audit.columns';

/** Converte `entity <-> entidade de domínio`; a auditoria vem do domínio, não do ORM. */
export const ContentBriefMapper = {
  toDomain(entity: ContentBriefEntity): ContentBriefDomainEntity {
    return ContentBriefDomainEntity.restore({
      id: entity.id,
      title: Title.restore(entity.title),
      description: Description.restore(entity.description),
      dueDate: entity.dueDate === null ? null : CalendarDate.of(entity.dueDate),
      status: entity.status,
      action: entity.action,
      channel: entity.channel,
      estateDevelopmentId: entity.estateDevelopmentId,
      ownerId: entity.ownerId,
      completedAt: entity.completedAt,
      deletion:
        entity.deletedAt === null || entity.deletedBy === null
          ? null
          : { at: entity.deletedAt, by: entity.deletedBy },
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

  toEntity(contentBrief: ContentBriefDomainEntity): ContentBriefEntity {
    const entity = new ContentBriefEntity();
    entity.id = contentBrief.id;
    entity.title = contentBrief.title.value;
    entity.description = contentBrief.description.value;
    entity.dueDate =
      contentBrief.dueDate === null ? null : contentBrief.dueDate.toString();
    entity.status = contentBrief.status;
    entity.action = contentBrief.action;
    entity.channel = contentBrief.channel;
    entity.estateDevelopmentId = contentBrief.estateDevelopmentId;
    entity.ownerId = contentBrief.ownerId;
    entity.completedAt = contentBrief.completedAt;
    entity.deletedAt = contentBrief.deletion?.at ?? null;
    entity.deletedBy = contentBrief.deletion?.by ?? null;
    entity.version = contentBrief.version;
    const audit = new AuditColumns();
    audit.createdAt = contentBrief.audit.createdAt;
    audit.createdBy = contentBrief.audit.createdBy;
    audit.createdByName = contentBrief.audit.createdByName;
    audit.updatedAt = contentBrief.audit.updatedAt;
    audit.updatedBy = contentBrief.audit.updatedBy;
    audit.updatedByName = contentBrief.audit.updatedByName;
    entity.audit = audit;
    return entity;
  },
};
