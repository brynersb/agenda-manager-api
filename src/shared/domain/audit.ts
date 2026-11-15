import type { Actor } from '@/shared/domain/actor';

/**
 * Quem criou e quem alterou por último, e quando (ADR-004). Os nomes são
 * snapshots: não mudam se a pessoa for renomeada no provedor de identidade.
 */
export type Audit = {
  readonly createdAt: Date;
  readonly createdBy: string;
  readonly createdByName: string | null;
  readonly updatedAt: Date;
  readonly updatedBy: string;
  readonly updatedByName: string | null;
};

/** Auditoria de um registro recém-criado: criação e alteração coincidem. */
export function newAudit(actor: Actor, now: Date): Audit {
  return {
    createdAt: now,
    createdBy: actor.id,
    createdByName: actor.name,
    updatedAt: now,
    updatedBy: actor.id,
    updatedByName: actor.name,
  };
}

/** Mantém a criação e atualiza só quem/quando alterou por último. */
export function updatedAudit(audit: Audit, actor: Actor, now: Date): Audit {
  return {
    ...audit,
    updatedAt: now,
    updatedBy: actor.id,
    updatedByName: actor.name,
  };
}
