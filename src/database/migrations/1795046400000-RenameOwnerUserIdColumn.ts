import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Autenticação própria (ADR-016): a coluna que ligava o responsável a um
 * usuário do provedor de identidade externo vira `user_id` (vínculo opcional
 * com `users`, sem FK e sem uso no MVP). Só renomeia: os dados ficam. A
 * migration que criou `owners` não é editada.
 */
export class RenameOwnerUserIdColumn1795046400000
  implements MigrationInterface
{
  name = 'RenameOwnerUserIdColumn1795046400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE owners RENAME COLUMN keycloak_user_id TO user_id',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE owners RENAME COLUMN user_id TO keycloak_user_id',
    );
  }
}
