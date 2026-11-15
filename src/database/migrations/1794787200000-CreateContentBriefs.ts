import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Pautas (plan §4): enums `content_brief_status`, `content_brief_action` e
 * `content_brief_channel`, a tabela `content_briefs` e os índices parciais
 * (só pautas não excluídas). `due_date` é `date` (sem hora, ADR-005).
 * Empreendimento e responsável entram por FK; como os cadastros nunca são
 * apagados (só arquivados), nenhuma FK precisa de `ON DELETE`.
 * `completed_at` é preenchida ao entrar em DONE e limpa ao sair; a exclusão é
 * lógica (`deleted_at`, `deleted_by`).
 *
 * Reescrita no lugar uma única vez (ADR-015, nomes em inglês); daqui em
 * diante, migration aplicada não se edita.
 */
export class CreateContentBriefs1794787200000 implements MigrationInterface {
  name = 'CreateContentBriefs1794787200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE content_brief_status AS ENUM ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE')`,
    );
    await queryRunner.query(
      `CREATE TYPE content_brief_action AS ENUM ('CHASE', 'DEVELOP', 'PAYMENT', 'CREATE', 'FOLLOW_UP', 'ANALYZE')`,
    );
    await queryRunner.query(
      `CREATE TYPE content_brief_channel AS ENUM ('INSTAGRAM', 'EMAIL', 'BLOG', 'ADS', 'VIDEO', 'WEBSITE', 'REPORT', 'OTHER')`,
    );

    await queryRunner.query(`
      CREATE TABLE content_briefs (
        id uuid PRIMARY KEY,
        title varchar(140) NOT NULL,
        description varchar(1200) NOT NULL DEFAULT '',
        due_date date,
        status content_brief_status NOT NULL DEFAULT 'TODO',
        action content_brief_action,
        channel content_brief_channel,
        estate_development_id uuid REFERENCES estate_developments (id),
        owner_id uuid REFERENCES owners (id),
        completed_at timestamptz,
        deleted_at timestamptz,
        deleted_by varchar(64),
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
      `CREATE INDEX ix_content_briefs_open_due_date ON content_briefs (due_date) WHERE deleted_at IS NULL AND status <> 'DONE'`,
    );
    await queryRunner.query(
      'CREATE INDEX ix_content_briefs_status ON content_briefs (status) WHERE deleted_at IS NULL',
    );
    await queryRunner.query(
      'CREATE INDEX ix_content_briefs_estate_development ON content_briefs (estate_development_id) WHERE deleted_at IS NULL',
    );
    await queryRunner.query(
      'CREATE INDEX ix_content_briefs_owner ON content_briefs (owner_id) WHERE deleted_at IS NULL',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS ix_content_briefs_owner');
    await queryRunner.query(
      'DROP INDEX IF EXISTS ix_content_briefs_estate_development',
    );
    await queryRunner.query('DROP INDEX IF EXISTS ix_content_briefs_status');
    await queryRunner.query(
      'DROP INDEX IF EXISTS ix_content_briefs_open_due_date',
    );
    await queryRunner.query('DROP TABLE IF EXISTS content_briefs');
    await queryRunner.query('DROP TYPE IF EXISTS content_brief_channel');
    await queryRunner.query('DROP TYPE IF EXISTS content_brief_action');
    await queryRunner.query('DROP TYPE IF EXISTS content_brief_status');
  }
}
