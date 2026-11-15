import { v7 as uuidv7 } from 'uuid';

import { Role } from '@/modules/auth/domain/enums/role';
import { UserStatus } from '@/modules/user/domain/enums/user-status';
import type { UserEmail } from '@/modules/user/domain/value-objects/user-email';
import type { UserName } from '@/modules/user/domain/value-objects/user-name';
import type { Actor } from '@/shared/domain/actor';
import { type Audit, newAudit, updatedAudit } from '@/shared/domain/audit';
import { DomainEntity } from '@/shared/domain/domain-entity';

/** Regra de bloqueio da conta: `maxAttempts` falhas seguidas travam por `lockMinutes`. */
export type LoginLockPolicy = {
  maxAttempts: number;
  lockMinutes: number;
};

const MS_PER_MINUTE = 60_000;

/** Estado persistido de um usuário, usado para reidratar o agregado. */
export type UserSnapshot = {
  id: string;
  name: UserName;
  email: UserEmail;
  role: Role;
  status: UserStatus;
  passwordHash: string;
  mustChangePassword: boolean;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  version: number;
  audit: Audit;
};

/**
 * Usuário do sistema (ADR-016). Nunca é apagado: `deactivate` impede o acesso e
 * `reactivate` o devolve. A senha só existe como hash.
 *
 * `version` é a versão lida do banco (concorrência otimista, ADR-006); quem a
 * incrementa é a persistência ao gravar. Os campos de login
 * (`failedLoginAttempts`, `lockedUntil`, `lastLoginAt`) mudam pelos métodos
 * `registerFailedLogin` e `registerSuccessfulLogin`, que a persistência grava à
 * parte, sem mexer em `version` nem na auditoria: um login não pode causar
 * conflito de versão numa edição de administrador.
 */
export class UserDomainEntity extends DomainEntity {
  private constructor(
    id: string,
    private _name: UserName,
    private readonly _email: UserEmail,
    private _role: Role,
    private _status: UserStatus,
    private _passwordHash: string,
    private _mustChangePassword: boolean,
    private _failedLoginAttempts: number,
    private _lockedUntil: Date | null,
    private _lastLoginAt: Date | null,
    private readonly _version: number,
    private _audit: Audit,
  ) {
    super(id);
  }

  /** Novo usuário ativo, com id uuid v7 e versão 1. O hash já vem pronto. */
  static create(
    props: {
      name: UserName;
      email: UserEmail;
      role: Role;
      passwordHash: string;
      mustChangePassword: boolean;
    },
    actor: Actor,
    now: Date,
  ): UserDomainEntity {
    return new UserDomainEntity(
      uuidv7(),
      props.name,
      props.email,
      props.role,
      UserStatus.ACTIVE,
      props.passwordHash,
      props.mustChangePassword,
      0,
      null,
      null,
      1,
      newAudit(actor, now),
    );
  }

  /** Reidrata do banco, sem validar de novo. */
  static restore(snapshot: UserSnapshot): UserDomainEntity {
    return new UserDomainEntity(
      snapshot.id,
      snapshot.name,
      snapshot.email,
      snapshot.role,
      snapshot.status,
      snapshot.passwordHash,
      snapshot.mustChangePassword,
      snapshot.failedLoginAttempts,
      snapshot.lockedUntil,
      snapshot.lastLoginAt,
      snapshot.version,
      snapshot.audit,
    );
  }

  rename(name: UserName, actor: Actor, now: Date): void {
    this._name = name;
    this.touch(actor, now);
  }

  changeRole(role: Role, actor: Actor, now: Date): void {
    this._role = role;
    this.touch(actor, now);
  }

  /** Idempotente: desativar um desativado não muda nada. */
  deactivate(actor: Actor, now: Date): void {
    if (this._status === UserStatus.DEACTIVATED) {
      return;
    }
    this._status = UserStatus.DEACTIVATED;
    this.touch(actor, now);
  }

  /** Idempotente. Reativar também destrava a conta. */
  reactivate(actor: Actor, now: Date): void {
    if (this._status === UserStatus.ACTIVE) {
      return;
    }
    this._status = UserStatus.ACTIVE;
    this.clearLock();
    this.touch(actor, now);
  }

  /** Troca feita pelo próprio usuário: encerra a obrigação de trocar e destrava a conta. */
  changePassword(passwordHash: string, actor: Actor, now: Date): void {
    this._passwordHash = passwordHash;
    this._mustChangePassword = false;
    this.clearLock();
    this.touch(actor, now);
  }

  /** Redefinição por administrador: a senha provisória obriga a troca no próximo login. */
  resetPassword(passwordHash: string, actor: Actor, now: Date): void {
    this._passwordHash = passwordHash;
    this._mustChangePassword = true;
    this.clearLock();
    this.touch(actor, now);
  }

  /** A conta está travada neste instante? O bloqueio termina em `lockedUntil`. */
  isLockedAt(now: Date): boolean {
    return (
      this._lockedUntil !== null && this._lockedUntil.getTime() > now.getTime()
    );
  }

  /** Minutos que faltam para destravar, arredondados para cima (0 se não está travada). */
  lockMinutesRemaining(now: Date): number {
    if (!this.isLockedAt(now) || this._lockedUntil === null) {
      return 0;
    }
    return Math.ceil(
      (this._lockedUntil.getTime() - now.getTime()) / MS_PER_MINUTE,
    );
  }

  /**
   * Conta uma senha errada. Ao atingir `maxAttempts` a conta trava por
   * `lockMinutes` e o contador volta a zero (passado o bloqueio, o usuário
   * recebe um novo conjunto de tentativas).
   */
  registerFailedLogin(now: Date, policy: LoginLockPolicy): void {
    // Bloqueio já vencido: o que sobrou dele não conta para a próxima rodada.
    if (this._lockedUntil !== null && !this.isLockedAt(now)) {
      this._lockedUntil = null;
    }
    this._failedLoginAttempts += 1;
    if (this._failedLoginAttempts >= policy.maxAttempts) {
      this._failedLoginAttempts = 0;
      this._lockedUntil = new Date(
        now.getTime() + policy.lockMinutes * MS_PER_MINUTE,
      );
    }
  }

  /** Login com sucesso: zera o contador e registra o instante. */
  registerSuccessfulLogin(now: Date): void {
    this.clearLock();
    this._lastLoginAt = now;
  }

  get isActive(): boolean {
    return this._status === UserStatus.ACTIVE;
  }

  /** Administrador ativo: o que a regra do "último admin" protege. */
  get isActiveAdmin(): boolean {
    return this._role === Role.Admin && this.isActive;
  }

  get name(): UserName {
    return this._name;
  }

  get email(): UserEmail {
    return this._email;
  }

  get role(): Role {
    return this._role;
  }

  get status(): UserStatus {
    return this._status;
  }

  get passwordHash(): string {
    return this._passwordHash;
  }

  get mustChangePassword(): boolean {
    return this._mustChangePassword;
  }

  get failedLoginAttempts(): number {
    return this._failedLoginAttempts;
  }

  get lockedUntil(): Date | null {
    return this._lockedUntil;
  }

  get lastLoginAt(): Date | null {
    return this._lastLoginAt;
  }

  get version(): number {
    return this._version;
  }

  get audit(): Audit {
    return this._audit;
  }

  private clearLock(): void {
    this._failedLoginAttempts = 0;
    this._lockedUntil = null;
  }

  private touch(actor: Actor, now: Date): void {
    this._audit = updatedAudit(this._audit, actor, now);
  }
}
