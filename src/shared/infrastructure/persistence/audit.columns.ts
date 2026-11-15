import { Column } from 'typeorm';

import type { Actor } from '@/shared/domain/actor';

/**
 * Colunas de auditoria de toda tabela de negócio (ADR-004). O nome do ator é
 * um snapshot: não muda se a pessoa for renomeada no provedor de identidade.
 * Uso no entity: `@Column(() => AuditColumns, { prefix: false }) audit`.
 */
export class AuditColumns {
  @Column({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'varchar', length: 64 })
  createdBy: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  createdByName: string | null;

  @Column({ type: 'timestamptz' })
  updatedAt: Date;

  @Column({ type: 'varchar', length: 64 })
  updatedBy: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  updatedByName: string | null;
}

/** Entity que carrega as colunas de auditoria em `audit`. */
export type EntityWithAudit = { audit?: AuditColumns };

/**
 * Preenche a auditoria antes de gravar: `updated*` sempre; `created*` só na
 * primeira gravação (quando ainda não há `createdAt`).
 */
export function applyAudit<T extends EntityWithAudit>(
  entity: T,
  actor: Actor,
  now: Date,
): T {
  const audit = entity.audit ?? new AuditColumns();

  if (!audit.createdAt) {
    audit.createdAt = now;
    audit.createdBy = actor.id;
    audit.createdByName = actor.name;
  }
  audit.updatedAt = now;
  audit.updatedBy = actor.id;
  audit.updatedByName = actor.name;

  entity.audit = audit;
  return entity;
}
