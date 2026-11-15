import type { OwnerReadModel } from '@/modules/owner/application/interfaces/repositories/owner-query.repository.interface';
import type { Actor } from '@/shared/domain/actor';

export type RenameOwnerInput = {
  id: string;
  name: string;
  /** Omitido mantém o e-mail atual; `null` ou em branco o remove. */
  email?: string | null;
  /** Versão que o cliente leu; divergência vira 409 (ADR-006). */
  version: number;
  actor: Actor;
};

export interface RenameOwnerUseCaseInterface {
  execute(input: RenameOwnerInput): Promise<OwnerReadModel>;
}

export const RENAME_OWNER_USE_CASE = Symbol('RenameOwnerUseCaseInterface');
