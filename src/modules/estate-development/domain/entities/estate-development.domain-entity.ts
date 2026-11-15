import { v7 as uuidv7 } from 'uuid';

import type { Actor } from '@/shared/domain/actor';
import { type Audit, newAudit, updatedAudit } from '@/shared/domain/audit';
import { DomainEntity } from '@/shared/domain/domain-entity';
import type { RegistryName } from '@/shared/domain/registry-name';

/** Estado persistido de um empreendimento, usado para reidratar o agregado. */
export type EstateDevelopmentSnapshot = {
  id: string;
  name: RegistryName;
  active: boolean;
  version: number;
  audit: Audit;
};

/**
 * Empreendimento (cadastro usado nas pautas). Nunca é apagado: `arquivar`
 * tira o nome da lista padrão, mas as pautas existentes continuam mostrando-o.
 *
 * `version` é a versão lida do banco (concorrência otimista, ADR-006); quem
 * a incrementa é a persistência ao gravar.
 */
export class EstateDevelopmentDomainEntity extends DomainEntity {
  private constructor(
    id: string,
    private _name: RegistryName,
    private _active: boolean,
    private readonly _version: number,
    private _audit: Audit,
  ) {
    super(id);
  }

  /** Novo empreendimento ativo, com id uuid v7 e versão 1. */
  static create(
    props: { name: RegistryName },
    actor: Actor,
    now: Date,
  ): EstateDevelopmentDomainEntity {
    return new EstateDevelopmentDomainEntity(
      uuidv7(),
      props.name,
      true,
      1,
      newAudit(actor, now),
    );
  }

  /** Reidrata do banco, sem validar de novo. */
  static restore(
    snapshot: EstateDevelopmentSnapshot,
  ): EstateDevelopmentDomainEntity {
    return new EstateDevelopmentDomainEntity(
      snapshot.id,
      snapshot.name,
      snapshot.active,
      snapshot.version,
      snapshot.audit,
    );
  }

  rename(name: RegistryName, actor: Actor, now: Date): void {
    this._name = name;
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
