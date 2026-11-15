import type { ContentBriefDetail } from '@/modules/content-brief/application/queries/find-content-brief-by-id/content-brief-detail';
import type { ContentBriefDataInput } from '@/modules/content-brief/application/use-cases/common/content-brief-data';
import type { Actor } from '@/shared/domain/actor';

export type CreateContentBriefInput = ContentBriefDataInput & { actor: Actor };

export interface CreateContentBriefUseCaseInterface {
  execute(input: CreateContentBriefInput): Promise<ContentBriefDetail>;
}

export const CREATE_CONTENT_BRIEF_USE_CASE = Symbol(
  'CreateContentBriefUseCaseInterface',
);
