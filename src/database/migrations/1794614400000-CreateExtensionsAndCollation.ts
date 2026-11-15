import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Base de busca e ordenação em pt-BR (plan §4): `unaccent` (não é IMMUTABLE,
 * então índices usam o wrapper `immutable_unaccent`) e a colação ICU `pt_br`.
 */
export class CreateExtensionsAndCollation1794614400000
  implements MigrationInterface
{
  name = 'CreateExtensionsAndCollation1794614400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS unaccent');
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION immutable_unaccent(text) RETURNS text
        LANGUAGE sql IMMUTABLE PARALLEL SAFE
        AS $$ SELECT public.unaccent('public.unaccent', $1) $$
    `);
    await queryRunner.query(
      `CREATE COLLATION IF NOT EXISTS pt_br (provider = icu, locale = 'pt-BR')`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP COLLATION IF EXISTS pt_br');
    await queryRunner.query('DROP FUNCTION IF EXISTS immutable_unaccent(text)');
    await queryRunner.query('DROP EXTENSION IF EXISTS unaccent');
  }
}
