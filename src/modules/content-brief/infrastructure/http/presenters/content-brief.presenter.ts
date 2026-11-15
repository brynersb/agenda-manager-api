import type { ContentBriefDetail } from '@/modules/content-brief/application/queries/find-content-brief-by-id/content-brief-detail';
import type { ListContentBriefsResult } from '@/modules/content-brief/application/queries/list-content-briefs/list-content-briefs.query.interface';
import type { ContentBriefResponseDto } from '@/modules/content-brief/infrastructure/http/dtos/content-brief.response.dto';
import type { ListContentBriefsResponseDto } from '@/modules/content-brief/infrastructure/http/dtos/list-content-briefs.response.dto';
import { toPageResponse } from '@/shared/infrastructure/http/pagination/page.response';

export function toContentBriefResponse(
  contentBrief: ContentBriefDetail,
): ContentBriefResponseDto {
  return {
    id: contentBrief.id,
    title: contentBrief.title,
    description: contentBrief.description,
    dueDate:
      contentBrief.dueDate === null ? null : contentBrief.dueDate.toString(),
    dueStatus: contentBrief.dueStatus,
    daysUntilDue: contentBrief.daysUntilDue,
    status: contentBrief.status,
    action: contentBrief.action,
    channel: contentBrief.channel,
    estateDevelopment: contentBrief.estateDevelopment
      ? { ...contentBrief.estateDevelopment }
      : null,
    owner: contentBrief.owner ? { ...contentBrief.owner } : null,
    completedAt: contentBrief.completedAt
      ? contentBrief.completedAt.toISOString()
      : null,
    version: contentBrief.version,
    createdAt: contentBrief.createdAt.toISOString(),
    createdBy: {
      id: contentBrief.createdBy.id,
      name: contentBrief.createdBy.name,
    },
    updatedAt: contentBrief.updatedAt.toISOString(),
    updatedBy: {
      id: contentBrief.updatedBy.id,
      name: contentBrief.updatedBy.name,
    },
  };
}

export function toContentBriefListResponse(
  result: ListContentBriefsResult,
): ListContentBriefsResponseDto {
  return toPageResponse(
    result.data.map(toContentBriefResponse),
    result.total,
    result.page,
    result.limit,
  );
}
