import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Refresh tokens opacos (ADR-016). Só o hash SHA-256 (hex, 64 caracteres) do
 * token é gravado, com índice único. `family_id` agrupa os tokens de um login
 * (rotação: cada uso gera um novo na mesma família e revoga o anterior;
 * reuso de um revogado revoga a família). `replaced_by_id` aponta o sucessor
 * (sem FK, de propósito: o novo token é gravado na mesma transação).
 * `user_agent` e `ip` são opcionais (auditoria de sessão).
 */
export class CreateRefreshTokens1794960000000 implements MigrationInterface {
  name = 'CreateRefreshTokens1794960000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE refresh_tokens (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users (id),
        family_id uuid NOT NULL,
        token_hash varchar(64) NOT NULL,
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz,
        replaced_by_id uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        user_agent varchar(255),
        ip varchar(45)
      )
    `);

    await queryRunner.query(
      'CREATE UNIQUE INDEX ux_refresh_tokens_token_hash ON refresh_tokens (token_hash)',
    );
    await queryRunner.query(
      'CREATE INDEX ix_refresh_tokens_family_id ON refresh_tokens (family_id)',
    );
    await queryRunner.query(
      'CREATE INDEX ix_refresh_tokens_user_id ON refresh_tokens (user_id)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS refresh_tokens');
  }
}
