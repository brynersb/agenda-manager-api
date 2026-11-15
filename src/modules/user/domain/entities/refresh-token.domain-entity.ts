import { v7 as uuidv7 } from 'uuid';

import { DomainEntity } from '@/shared/domain/domain-entity';

/** Estado persistido de um refresh token, usado para reidratar a entidade. */
export type RefreshTokenSnapshot = {
  id: string;
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedById: string | null;
  createdAt: Date;
  userAgent: string | null;
  ip: string | null;
};

/** Situação de um refresh token apresentado pelo cliente. */
export type RefreshTokenStatus = 'usable' | 'expired' | 'revoked';

/**
 * Refresh token opaco (ADR-016). Só o hash SHA-256 do token existe aqui; o
 * valor em claro vai uma única vez ao cliente. Os tokens de um login formam uma
 * "família" (`familyId`): cada uso gera um novo token na mesma família e
 * revoga o anterior (rotação). Apresentar um token já revogado é sinal de
 * roubo/reuso, e a família inteira é revogada.
 */
export class RefreshTokenDomainEntity extends DomainEntity {
  private constructor(
    id: string,
    readonly userId: string,
    readonly familyId: string,
    readonly tokenHash: string,
    readonly expiresAt: Date,
    private _revokedAt: Date | null,
    private _replacedById: string | null,
    readonly createdAt: Date,
    readonly userAgent: string | null,
    readonly ip: string | null,
  ) {
    super(id);
  }

  /**
   * Novo token. `familyId` ausente inicia uma família nova (login); presente,
   * continua a família do token que está sendo rotacionado.
   */
  static issue(
    props: {
      userId: string;
      familyId?: string;
      tokenHash: string;
      expiresAt: Date;
      userAgent?: string | null;
      ip?: string | null;
    },
    now: Date,
  ): RefreshTokenDomainEntity {
    return new RefreshTokenDomainEntity(
      uuidv7(),
      props.userId,
      props.familyId ?? uuidv7(),
      props.tokenHash,
      props.expiresAt,
      null,
      null,
      now,
      props.userAgent ?? null,
      props.ip ?? null,
    );
  }

  static restore(snapshot: RefreshTokenSnapshot): RefreshTokenDomainEntity {
    return new RefreshTokenDomainEntity(
      snapshot.id,
      snapshot.userId,
      snapshot.familyId,
      snapshot.tokenHash,
      snapshot.expiresAt,
      snapshot.revokedAt,
      snapshot.replacedById,
      snapshot.createdAt,
      snapshot.userAgent,
      snapshot.ip,
    );
  }

  /**
   * Revogado vence expirado: um token revogado e vencido ainda é "reuso" para
   * quem o apresenta, e a família é derrubada.
   */
  statusAt(now: Date): RefreshTokenStatus {
    if (this._revokedAt !== null) {
      return 'revoked';
    }
    return this.expiresAt.getTime() <= now.getTime() ? 'expired' : 'usable';
  }

  get revokedAt(): Date | null {
    return this._revokedAt;
  }

  get replacedById(): string | null {
    return this._replacedById;
  }
}
