import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cadastros de pauta (plan §4): `estate_developments` e `owners`. O índice
 * único de nome é sobre `normalized_name`, calculado pelo domínio (sem caixa
 * e sem acento), e vale também para arquivados: reativar nunca conflita. A
 * migration não recalcula a normalização para não criar uma segunda regra.
 * `normalized_name` é mais largo que `name` porque a decomposição Unicode
 * pode alongar o texto (ex.: sílabas Hangul).
 *
 * Reescrita no lugar uma única vez (ADR-015, nomes em inglês); daqui em
 * diante, migration aplicada não se edita.
 */
export class CreateEstateDevelopmentsAndOwners1794700800000
  implements MigrationInterface
{
  name = 'CreateEstateDevelopmentsAndOwners1794700800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE estate_developments (
        id uuid PRIMARY KEY,
        name varchar(80) NOT NULL,
        normalized_name varchar(240) NOT NULL,
        active boolean NOT NULL DEFAULT true,
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
      'CREATE UNIQUE INDEX ux_estate_developments_name ON estate_developments (normalized_name)',
    );

    await queryRunner.query(`
      CREATE TABLE owners (
        id uuid PRIMARY KEY,
        name varchar(80) NOT NULL,
        normalized_name varchar(240) NOT NULL,
        email varchar(254),
        keycloak_user_id varchar(64),
        active boolean NOT NULL DEFAULT true,
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
      'CREATE UNIQUE INDEX ux_owners_name ON owners (normalized_name)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS ux_owners_name');
    await queryRunner.query('DROP TABLE IF EXISTS owners');
    await queryRunner.query('DROP INDEX IF EXISTS ux_estate_developments_name');
    await queryRunner.query('DROP TABLE IF EXISTS estate_developments');
  }
}
