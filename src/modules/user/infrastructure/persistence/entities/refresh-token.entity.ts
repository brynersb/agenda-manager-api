import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Tabela `refresh_tokens`. Guarda só o hash SHA-256 (hex) do token: o valor em
 * claro nunca é gravado. Os índices (`ux_refresh_tokens_token_hash`,
 * `ix_refresh_tokens_family_id`, `ix_refresh_tokens_user_id`) existem na
 * migration. `user_id` tem FK para `users`; `replaced_by_id` aponta o token
 * que o substituiu na rotação.
 */
@Entity('refresh_tokens')
export class RefreshTokenEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  familyId: string;

  @Column({ type: 'varchar', length: 64 })
  tokenHash: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  replacedById: string | null;

  @Column({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userAgent: string | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip: string | null;
}
