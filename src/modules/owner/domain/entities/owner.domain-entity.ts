import { v7 as uuidv7 } from 'uuid';

import type { Email } from '@/modules/owner/domain/value-objects/email';
import type { Actor } from '@/shared/domain/actor';
import { type Audit, newAudit, updatedAudit } from '@/shared/domain/audit';
import { DomainEntity } from '@/shared/domain/domain-entity';
import type { RegistryName } from '@/shared/domain/registry-name';

/** Estado persistido de um responsável, usado para reidratar o agregado. */
export type OwnerSnapshot = {
  id: string;
  name: RegistryName;
  email: Email | null;
  userId: string | null;
  active: boolean;
  version: number;
  audit: Audit;
};

/**
 * Responsável (cadastro usado nas pautas). Nunca é apagado: `arquivar` tira o
 * nome da lista padrão, mas as pautas existentes continuam mostrando-o.
 *
 * `version` é a versão lida do banco (concorrência otimista, ADR-006); quem a
 * incrementa é a persistência ao gravar. `userId` é o vínculo opcional
 * com um usuário do sistema (`users`): sem uso no MVP, só persiste (sem FK).
 */
export class OwnerDomainEntity extends DomainEntity {
  private constructor(
    id: string,
    private _name: RegistryName,
    private _email: Email | null,
    private readonly _userId: string | null,
    private _active: boolean,
    private readonly _version: number,
    private _audit: Audit,
  ) {
    super(id);
  }

  /** Novo responsável ativo, com id uuid v7 e versão 1. */
  static create(
    props: { name: RegistryName; email?: Email | null },
    actor: Actor,
    now: Date,
  ): OwnerDomainEntity {
    return new OwnerDomainEntity(
      uuidv7(),
      props.name,
      props.email ?? null,
      null,
      true,
      1,
      newAudit(actor, now),
    );
  }

  /** Reidrata do banco, sem validar de novo. */
  static restore(snapshot: OwnerSnapshot): OwnerDomainEntity {
    return new OwnerDomainEntity(
      snapshot.id,
      snapshot.name,
      snapshot.email,
      snapshot.userId,
      snapshot.active,
      snapshot.version,
      snapshot.audit,
    );
  }

  rename(name: RegistryName, actor: Actor, now: Date): void {
    this._name = name;
    this._audit = updatedAudit(this._audit, actor, now);
  }

  /** `null` remove o e-mail. */
  changeEmail(email: Email | null, actor: Actor, now: Date): void {
    this._email = email;
    this._audit = updatedAudit(this._audit, actor, now);
  }

  /** Idempotente: arquivar um arquivado não muda nada. */
  archive(actor: Actor, now: Date): void {
    if (!this._active) {
      return;
    }
    this._active = false;
    this._audit = updatedAudit(this._audit, actor, now);
  }

  /** Idempotente: reativar um ativo não muda nada. */
  reactivate(actor: Actor, now: Date): void {
    if (this._active) {
      return;
    }
    this._active = true;
    this._audit = updatedAudit(this._audit, actor, now);
  }

  get name(): RegistryName {
    return this._name;
  }

  get email(): Email | null {
    return this._email;
  }

  get userId(): string | null {
    return this._userId;
  }

  get active(): boolean {
    return this._active;
  }

  get version(): number {
    return this._version;
  }

  get audit(): Audit {
    return this._audit;
  }
}
