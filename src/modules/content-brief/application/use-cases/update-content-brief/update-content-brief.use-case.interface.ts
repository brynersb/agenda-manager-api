import type { ContentBriefDetail } from '@/modules/content-brief/application/queries/find-content-brief-by-id/content-brief-detail';
import type { ContentBriefDataInput } from '@/modules/content-brief/application/use-cases/common/content-brief-data';
import type { Actor } from '@/shared/domain/actor';

export type UpdateContentBriefInput = ContentBriefDataInput & {
  id: string;
  /** Versão que o cliente leu; divergência vira 409 (ADR-006). */
  version: number;
  actor: Actor;
};

export interface UpdateContentBriefUseCaseInterface {
  execute(input: UpdateContentBriefInput): Promise<ContentBriefDetail>;
}

export const UPDATE_CONTENT_BRIEF_USE_CASE = Symbol(
  'UpdateContentBriefUseCaseInterface',
);
