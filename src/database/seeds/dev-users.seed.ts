import type { DataSource } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';

import type { Seed } from '@/database/seeds/seed';
import { Role } from '@/modules/auth/domain/enums/role';
import { assertPasswordPolicy } from '@/modules/user/domain/services/password-policy';
import { UserEmail } from '@/modules/user/domain/value-objects/user-email';
import { UserName } from '@/modules/user/domain/value-objects/user-name';
import type { ClockInterface } from '@/shared/application/interfaces/clock.interface';
import type { PasswordHasherInterface } from '@/shared/application/interfaces/password-hasher.interface';
import type { Actor } from '@/shared/domain/actor';

/** Autor da auditoria dos usuários de desenvolvimento. */
export const DEV_USERS_ACTOR: Actor = {
  id: 'seed',
  name: 'Seed de desenvolvimento',
};

/**
 * SENHA SÓ DE DESENVOLVIMENTO dos usuários `dev.*@pauta.local`. É pública (está
 * no repositório) e nunca deve existir fora de uma máquina de desenvolvimento
 * ou da demonstração local. `SEED_DEV_PASSWORD` a sobrescreve.
 */
export const DEV_USER_PASSWORD = 'dev-only-pauta-2026';

type DevUser = { name: string; email: string; role: Role };

export const DEV_USERS: readonly DevUser[] = [
  { name: 'Dev Admin', email: 'dev.admin@pauta.local', role: Role.Admin },
  { name: 'Dev Editor', email: 'dev.editor@pauta.local', role: Role.Editor },
  { name: 'Dev Leitor', email: 'dev.leitor@pauta.local', role: Role.Viewer },
];

/**
 * Seed dos três usuários de desenvolvimento (admin, editor, leitor), com
 * `mustChangePassword = false` para entrar direto. Idempotente: o e-mail único
 * (`ux_users_email`) torna o `ON CONFLICT` um no-op, e a senha de um usuário
 * já existente não é alterada. Só roda em STAGE `local` ou `demo`
 * (`run-seed.ts` recusa os demais).
 */
export function createDevUsersSeed(
  getClock: () => ClockInterface,
  getHasher: () => PasswordHasherInterface,
): Seed {
  return {
    name: 'dev-users',
    async execute(dataSource: DataSource): Promise<void> {
      const clock = getClock();
      const hasher = getHasher();
      const password = process.env.SEED_DEV_PASSWORD || DEV_USER_PASSWORD;
      assertPasswordPolicy(password);
      const now = clock.now();

      for (const devUser of DEV_USERS) {
        const name = UserName.create(devUser.name);
        const email = UserEmail.create(devUser.email);
        await dataSource.query(
          `INSERT INTO users
             (id, name, email, role, status, password_hash, must_change_password,
              failed_login_attempts, version,
              created_at, created_by, created_by_name,
              updated_at, updated_by, updated_by_name)
           VALUES ($1, $2, $3, $4::user_role, 'ACTIVE', $5, false,
                   0, 1, $6, $7, $8, $6, $7, $8)
           ON CONFLICT (lower(email)) DO NOTHING`,
          [
            uuidv7(),
            name.value,
            email.value,
            devUser.role,
            await hasher.hash(password),
            now,
            DEV_USERS_ACTOR.id,
            DEV_USERS_ACTOR.name,
          ],
        );
      }
    },
  };
}
