import { v7 as uuidv7 } from 'uuid';

import type { ContentBriefAction } from '@/modules/content-brief/domain/enums/content-brief-action';
import type { ContentBriefChannel } from '@/modules/content-brief/domain/enums/content-brief-channel';
import { ContentBriefStatus } from '@/modules/content-brief/domain/enums/content-brief-status';
import {
  ContentBriefNotFoundError,
  ContentBriefVersionOutdatedError,
} from '@/modules/content-brief/domain/errors/content-brief.errors';
import type { Description } from '@/modules/content-brief/domain/value-objects/description';
import type { Title } from '@/modules/content-brief/domain/value-objects/title';
import type { Actor } from '@/shared/domain/actor';
import { type Audit, newAudit, updatedAudit } from '@/shared/domain/audit';
import type { CalendarDate } from '@/shared/domain/calendar-date';
import { DomainEntity } from '@/shared/domain/domain-entity';

/**
 * Campos editáveis de uma pauta. `status` ausente significa "padrão" ao criar
 * (`TODO`) e "manter o atual" ao editar. Os demais são substituídos por
 * inteiro: `null` limpa o campo.
 */
export type ContentBriefData = {
  title: Title;
  description: Description;
  dueDate: CalendarDate | null;
  status?: ContentBriefStatus;
  action: ContentBriefAction | null;
  channel: ContentBriefChannel | null;
  estateDevelopmentId: string | null;
  ownerId: string | null;
};

/** Quem excluiu a pauta e quando (exclusão lógica). */
export type ContentBriefDeletion = { readonly at: Date; readonly by: string };

/** Estado persistido de uma pauta, usado para reidratar o agregado. */
export type ContentBriefSnapshot = {
  id: string;
  title: Title;
  description: Description;
  dueDate: CalendarDate | null;
  status: ContentBriefStatus;
  action: ContentBriefAction | null;
  channel: ContentBriefChannel | null;
  estateDevelopmentId: string | null;
  ownerId: string | null;
  completedAt: Date | null;
  deletion: ContentBriefDeletion | null;
  version: number;
  audit: Audit;
};

/**
 * Pauta de marketing, o agregado central. Referencia empreendimento e
 * responsável só por id.
 *
 * `version` é a versão lida do banco (concorrência otimista, ADR-006): quem
 * a incrementa é a persistência ao gravar. As operações de escrita exigem a
 * versão que o cliente leu e recusam divergência. Uma pauta excluída se
 * comporta como inexistente (o repositório sequer a devolve).
 */
export class ContentBriefDomainEntity extends DomainEntity {
  private constructor(
    id: string,
    private _title: Title,
    private _description: Description,
    private _dueDate: CalendarDate | null,
    private _status: ContentBriefStatus,
    private _action: ContentBriefAction | null,
    private _channel: ContentBriefChannel | null,
    private _estateDevelopmentId: string | null,
    private _ownerId: string | null,
    private _completedAt: Date | null,
    private _deletion: ContentBriefDeletion | null,
    private readonly _version: number,
    private _audit: Audit,
  ) {
    super(id);
  }

  /** Nova pauta, com id uuid v7 e versão 1; o status padrão é `TODO`. */
  static create(
    data: ContentBriefData,
    actor: Actor,
    now: Date,
  ): ContentBriefDomainEntity {
    const status = data.status ?? ContentBriefStatus.TODO;
    return new ContentBriefDomainEntity(
      uuidv7(),
      data.title,
      data.description,
      data.dueDate,
      status,
      data.action,
      data.channel,
      data.estateDevelopmentId,
      data.ownerId,
      status === ContentBriefStatus.DONE ? now : null,
      null,
      1,
      newAudit(actor, now),
    );
  }

  /** Reidrata do banco, sem validar de novo. */
  static restore(snapshot: ContentBriefSnapshot): ContentBriefDomainEntity {
    return new ContentBriefDomainEntity(
      snapshot.id,
      snapshot.title,
      snapshot.description,
      snapshot.dueDate,
      snapshot.status,
      snapshot.action,
      snapshot.channel,
      snapshot.estateDevelopmentId,
      snapshot.ownerId,
      snapshot.completedAt,
      snapshot.deletion,
      snapshot.version,
      snapshot.audit,
    );
  }

  /** Lança `CONTENT_BRIEF_VERSION_OUTDATED` se o cliente leu outra versão. */
  verifyVersion(expectedVersion: number): void {
    this.assertNotDeleted();
    if (expectedVersion !== this._version) {
      throw new ContentBriefVersionOutdatedError();
    }
  }

  /** Substitui os campos editáveis (o `status` só se vier informado). */
  update(
    data: ContentBriefData,
    expectedVersion: number,
    actor: Actor,
    now: Date,
  ): void {
    this.verifyVersion(expectedVersion);
    this._title = data.title;
    this._description = data.description;
    this._dueDate = data.dueDate;
    this._action = data.action;
    this._channel = data.channel;
    this._estateDevelopmentId = data.estateDevelopmentId;
    this._ownerId = data.ownerId;
    if (data.status !== undefined) {
      this.applyStatus(data.status, now);
    }
    this._audit = updatedAudit(this._audit, actor, now);
  }

  /**
   * Troca o status (livre entre os quatro). Entrar em `DONE` grava
   * `completedAt`; sair limpa; repetir `DONE` mantém o instante original.
   */
  changeStatus(
    status: ContentBriefStatus,
    expectedVersion: number,
    actor: Actor,
    now: Date,
  ): void {
    this.verifyVersion(expectedVersion);
    this.applyStatus(status, now);
    this._audit = updatedAudit(this._audit, actor, now);
  }

  /** Exclusão lógica: grava quem e quando; a pauta passa a não ser devolvida. */
  delete(actor: Actor, now: Date): void {
    this.assertNotDeleted();
    this._deletion = { at: now, by: actor.id };
    this._audit = updatedAudit(this._audit, actor, now);
  }

  /**
   * `true` quando `newId` é diferente do empreendimento atual (inclusive
   * `null`). Quem atribui um id novo precisa validar que ele está ativo;
   * manter o já atribuído, mesmo arquivado depois, não precisa.
   */
  estateDevelopmentChanged(newId: string | null): boolean {
    return newId !== this._estateDevelopmentId;
  }

  /** Idem `estateDevelopmentChanged`, para o responsável. */
  ownerChanged(newId: string | null): boolean {
    return newId !== this._ownerId;
  }

  get title(): Title {
    return this._title;
  }

  get description(): Description {
    return this._description;
  }

  get dueDate(): CalendarDate | null {
    return this._dueDate;
  }

  get status(): ContentBriefStatus {
    return this._status;
  }

  get action(): ContentBriefAction | null {
    return this._action;
  }

  get channel(): ContentBriefChannel | null {
    return this._channel;
  }

  get estateDevelopmentId(): string | null {
    return this._estateDevelopmentId;
  }

  get ownerId(): string | null {
    return this._ownerId;
  }

  get completedAt(): Date | null {
    return this._completedAt;
  }

  get deletion(): ContentBriefDeletion | null {
    return this._deletion;
  }

  get version(): number {
    return this._version;
  }

  get audit(): Audit {
    return this._audit;
  }

  private applyStatus(next: ContentBriefStatus, now: Date): void {
    const enteredDone =
      next === ContentBriefStatus.DONE &&
      this._status !== ContentBriefStatus.DONE;
    const leftDone =
      next !== ContentBriefStatus.DONE &&
      this._status === ContentBriefStatus.DONE;
    if (enteredDone) {
      this._completedAt = now;
    } else if (leftDone) {
      this._completedAt = null;
    }
    this._status = next;
  }

  private assertNotDeleted(): void {
    if (this._deletion !== null) {
      throw new ContentBriefNotFoundError();
    }
  }
}
