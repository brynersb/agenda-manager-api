import type { ContentBriefDetail } from '@/modules/content-brief/application/queries/find-content-brief-by-id/content-brief-detail';
import type { ContentBriefStatus } from '@/modules/content-brief/domain/enums/content-brief-status';
import type { Actor } from '@/shared/domain/actor';

export type ChangeContentBriefStatusInput = {
  id: string;
  status: ContentBriefStatus;
  /** Versão que o cliente leu; divergência vira 409 (ADR-006). */
  version: number;
  actor: Actor;
};

export interface ChangeContentBriefStatusUseCaseInterface {
  execute(input: ChangeContentBriefStatusInput): Promise<ContentBriefDetail>;
}

export const CHANGE_CONTENT_BRIEF_STATUS_USE_CASE = Symbol(
  'ChangeContentBriefStatusUseCaseInterface',
);
