import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Usuários da autenticação própria (ADR-016): enums `user_role` e
 * `user_status` e a tabela `users`. O e-mail é guardado em minúsculas e o
 * índice único é sobre `lower(email)` (defesa em profundidade: o domínio já
 * normaliza). `password_hash` guarda o hash argon2id (nunca a senha).
 * `locked_until`/`failed_login_attempts` implementam o bloqueio por tentativas
 * e `version` é a concorrência otimista das edições de administrador.
 * `created_by`/`updated_by` seguem varchar(64) como nas demais tabelas: guardam
 * o uuid do usuário (ou `bootstrap`/`seed`).
 */
export class CreateUsers1794873600000 implements MigrationInterface {
  name = 'CreateUsers1794873600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE user_role AS ENUM ('admin', 'content-brief-editor', 'content-brief-viewer')`,
    );
    await queryRunner.query(
      `CREATE TYPE user_status AS ENUM ('ACTIVE', 'DEACTIVATED')`,
    );

    await queryRunner.query(`
      CREATE TABLE users (
        id uuid PRIMARY KEY,
        name varchar(120) NOT NULL,
        email varchar(254) NOT NULL,
        role user_role NOT NULL,
        status user_status NOT NULL DEFAULT 'ACTIVE',
        password_hash varchar(255) NOT NULL,
        must_change_password boolean NOT NULL DEFAULT true,
        failed_login_attempts int NOT NULL DEFAULT 0,
        locked_until timestamptz,
        last_login_at timestamptz,
        version int NOT NULL DEFAULT 1,
        created_at timestamptz NOT NULL DEFAULT now(),
        created_by varchar(64) NOT NULL,
        created_by_name varchar(120),
        updated_at timestamptz NOT NULL DEFAULT now(),
        updated_by varchar(64) NOT NULL,
        updated_by_name varchar(120)
      )
    `);

    await queryRunner.query(
      'CREATE UNIQUE INDEX ux_users_email ON users (lower(email))',
    );
    await queryRunner.query(
      `CREATE INDEX ix_users_active_admins ON users (id) WHERE role = 'admin' AND status = 'ACTIVE'`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS users');
    await queryRunner.query('DROP TYPE IF EXISTS user_status');
    await queryRunner.query('DROP TYPE IF EXISTS user_role');
  }
}
