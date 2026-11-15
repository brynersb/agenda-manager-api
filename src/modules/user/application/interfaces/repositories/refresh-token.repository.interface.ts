import type { RefreshTokenDomainEntity } from '@/modules/user/domain/entities/refresh-token.domain-entity';

/** Persistência dos refresh tokens (só o hash do token é guardado). */
export interface RefreshTokenRepositoryInterface {
  create(token: RefreshTokenDomainEntity): Promise<void>;

  /** `tokenHash` é o SHA-256 (hex) do token em claro. */
  findByTokenHash(tokenHash: string): Promise<RefreshTokenDomainEntity | null>;

  /**
   * Rotação atômica: grava `next` e revoga `currentId` (apontando
   * `replaced_by_id` para `next`) numa transação, **somente se** `currentId`
   * ainda não estiver revogado. Devolve `false` (sem gravar nada) quando
   * outra requisição já o usou: é reuso e o chamador deve revogar a família.
   */
  rotate(
    currentId: string,
    next: RefreshTokenDomainEntity,
    now: Date,
  ): Promise<boolean>;

  /** Revoga os tokens ainda ativos da família. Idempotente. */
  revokeFamily(familyId: string, now: Date): Promise<void>;

  /** Revoga todos os tokens ainda ativos do usuário (troca/redefinição de senha, desativação). */
  revokeAllByUserId(userId: string, now: Date): Promise<void>;
}

export const REFRESH_TOKEN_REPOSITORY = Symbol(
  'RefreshTokenRepositoryInterface',
);
