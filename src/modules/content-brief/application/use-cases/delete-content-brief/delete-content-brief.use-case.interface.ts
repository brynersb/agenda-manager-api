import type { Actor } from '@/shared/domain/actor';

export type DeleteContentBriefInput = { id: string; actor: Actor };

export interface DeleteContentBriefUseCaseInterface {
  execute(input: DeleteContentBriefInput): Promise<void>;
}

export const DELETE_CONTENT_BRIEF_USE_CASE = Symbol(
  'DeleteContentBriefUseCaseInterface',
);
