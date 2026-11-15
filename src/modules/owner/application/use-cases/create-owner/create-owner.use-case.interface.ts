import type { OwnerReadModel } from '@/modules/owner/application/interfaces/repositories/owner-query.repository.interface';
import type { Actor } from '@/shared/domain/actor';

export type CreateOwnerInput = {
  name: string;
  /** Ausente ou em branco significa sem e-mail. */
  email?: string | null;
  actor: Actor;
};

export interface CreateOwnerUseCaseInterface {
  execute(input: CreateOwnerInput): Promise<OwnerReadModel>;
}

export const CREATE_OWNER_USE_CASE = Symbol('CreateOwnerUseCaseInterface');
