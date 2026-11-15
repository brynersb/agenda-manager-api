import type { ContentBriefDetail } from '@/modules/content-brief/application/queries/find-content-brief-by-id/content-brief-detail';

export type FindContentBriefByIdInput = { id: string };

export interface FindContentBriefByIdQueryInterface {
  execute(input: FindContentBriefByIdInput): Promise<ContentBriefDetail>;
}

export const FIND_CONTENT_BRIEF_BY_ID_QUERY = Symbol(
  'FindContentBriefByIdQueryInterface',
);
