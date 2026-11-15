import type { ContentBriefSummary } from '@/modules/content-brief/application/queries/summarize-content-briefs/summarize-content-briefs.query.interface';
import type { ContentBriefSummaryResponseDto } from '@/modules/content-brief/infrastructure/http/dtos/content-brief-summary.response.dto';

export function toContentBriefSummaryResponse(
  summary: ContentBriefSummary,
): ContentBriefSummaryResponseDto {
  return {
    today: summary.today.toString(),
    total: summary.total,
    byDueStatus: { ...summary.byDueStatus },
    byStatus: { ...summary.byStatus },
  };
}
