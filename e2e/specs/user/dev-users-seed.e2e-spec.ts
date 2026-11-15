import {
  createDevUsersSeed,
  DEV_USER_PASSWORD,
  DEV_USERS,
} from '@/database/seeds/dev-users.seed';
import { Argon2PasswordHasher } from '@/shared/infrastructure/security/argon2-password-hasher';
import { cleanDatabase } from '../../src/core/database';
import { login } from '../../src/core/users';
import { type AppE2e, bootstrapApp } from '../../src/runner/app-bootstrap';

describe('Seed dos usuários de desenvolvimento (e2e)', () => {
  let e2e: AppE2e;

  beforeAll(async () => {
    e2e = await bootstrapApp();
  });

  afterAll(async () => {
    await e2e.close();
  });

  beforeEach(async () => {
    await cleanDatabase(e2e.dataSource);
    delete process.env.SEED_DEV_PASSWORD;
  });

  const runSeed = () =>
    createDevUsersSeed(
      () => e2e.clock,
      () => new Argon2PasswordHasher(),
    ).execute(e2e.dataSource);

  it('cria dev.admin, dev.editor e dev.leitor com a senha de desenvolvimento, sem troca obrigatória', async () => {
    await runSeed();

    const rows = await e2e.dataSource.query(
      'SELECT email, role, status, must_change_password FROM users ORDER BY email',
    );
    expect(rows).toEqual([
      {
        email: 'dev.admin@pauta.local',
        role: 'admin',
        status: 'ACTIVE',
        must_change_password: false,
      },
      {
        email: 'dev.editor@pauta.local',
        role: 'content-brief-editor',
        status: 'ACTIVE',
        must_change_password: false,
      },
      {
        email: 'dev.leitor@pauta.local',
        role: 'content-brief-viewer',
        status: 'ACTIVE',
        must_change_password: false,
      },
    ]);
  });

  it.each(DEV_USERS)(
    '$email entra com a senha de desenvolvimento',
    async (devUser) => {
      await runSeed();

      const res = await login(e2e, {
        email: devUser.email,
        password: DEV_USER_PASSWORD,
      });

      expect(res.status).toBe(200);
      expect(res.body.mustChangePassword).toBe(false);
      expect(res.body.user.role).toBe(devUser.role);
    },
  );

  it('é idempotente e não sobrescreve a senha de quem já existe', async () => {
    await runSeed();
    const [before] = await e2e.dataSource.query(
      `SELECT id, password_hash FROM users WHERE email = 'dev.admin@pauta.local'`,
    );

    await runSeed();

    const rows = await e2e.dataSource.query(
      'SELECT id, password_hash FROM users',
    );
    expect(rows).toHaveLength(3);
    const [after] = await e2e.dataSource.query(
      `SELECT id, password_hash FROM users WHERE email = 'dev.admin@pauta.local'`,
    );
    expect(after).toEqual(before);
  });

  it('SEED_DEV_PASSWORD sobrescreve a senha, mas recusa valor fora da política', async () => {
    process.env.SEED_DEV_PASSWORD = 'outra-senha-de-dev-9';
    await runSeed();

    const res = await login(e2e, {
      email: 'dev.editor@pauta.local',
      password: 'outra-senha-de-dev-9',
    });
    expect(res.status).toBe(200);

    process.env.SEED_DEV_PASSWORD = 'curta';
    await expect(runSeed()).rejects.toMatchObject({ code: 'WEAK_PASSWORD' });
  });

  it('os usuários do seed têm a auditoria do autor `seed`', async () => {
    await runSeed();

    const [row] = await e2e.dataSource.query(
      `SELECT created_by, created_by_name, version FROM users WHERE email = 'dev.admin@pauta.local'`,
    );
    expect(row).toEqual({
      created_by: 'seed',
      created_by_name: 'Seed de desenvolvimento',
      version: 1,
    });
  });
});
