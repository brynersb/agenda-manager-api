import { cleanDatabase } from '../../src/core/database';
import { createUser, login } from '../../src/core/users';
import { type AppE2e, bootstrapApp } from '../../src/runner/app-bootstrap';

const BOOTSTRAP_ENV = {
  BOOTSTRAP_ADMIN_EMAIL: 'Primeiro.Admin@Pauta.Local',
  BOOTSTRAP_ADMIN_PASSWORD: 'senha-inicial-do-admin-1',
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  must_change_password: boolean;
  created_by: string;
};

describe('Administrador inicial / bootstrap (e2e)', () => {
  let e2e: AppE2e | undefined;

  /** Sobe o app (o bootstrap roda no `onModuleInit`) depois de fechar o anterior. */
  async function boot(): Promise<AppE2e> {
    await e2e?.close();
    e2e = await bootstrapApp({ env: BOOTSTRAP_ENV });
    return e2e;
  }

  /** Esvazia o banco usando um app já no ar e o fecha, para o próximo boot partir do zero. */
  async function emptyDatabase(): Promise<void> {
    const app = await boot();
    await cleanDatabase(app.dataSource);
  }

  const users = (app: AppE2e): Promise<UserRow[]> =>
    app.dataSource.query(
      'SELECT id, name, email, role, status, must_change_password, created_by FROM users ORDER BY created_at',
    );

  afterAll(async () => {
    await e2e?.close();
  });

  it('com o banco sem nenhum usuário, cria o admin inicial com troca de senha obrigatória', async () => {
    await emptyDatabase();

    const app = await boot();

    const rows = await users(app);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      email: 'primeiro.admin@pauta.local',
      role: 'admin',
      status: 'ACTIVE',
      must_change_password: true,
      created_by: 'bootstrap',
    });
  });

  it('o admin inicial entra com a senha configurada e é obrigado a trocá-la', async () => {
    await emptyDatabase();
    const app = await boot();

    const res = await login(app, {
      email: 'primeiro.admin@pauta.local',
      password: BOOTSTRAP_ENV.BOOTSTRAP_ADMIN_PASSWORD,
    });

    expect(res.status).toBe(200);
    expect(res.body.mustChangePassword).toBe(true);
    expect(res.body.user.role).toBe('admin');
    expect(res.body.user.permissions).toContain('user:write');
  });

  it('guarda só o hash da senha', async () => {
    await emptyDatabase();
    const app = await boot();

    const [row] = await app.dataSource.query('SELECT password_hash FROM users');

    expect(row.password_hash).toMatch(/^\$argon2id\$/);
    expect(row.password_hash).not.toContain(
      BOOTSTRAP_ENV.BOOTSTRAP_ADMIN_PASSWORD,
    );
  });

  it('é idempotente: subir de novo não recria nem altera o admin', async () => {
    await emptyDatabase();
    const first = await boot();
    const [created] = await users(first);
    await first.dataSource.query(
      `UPDATE users SET name = 'Renomeado' WHERE id = $1`,
      [created.id],
    );

    const second = await boot();
    const third = await boot();

    const rows = await users(third);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: created.id, name: 'Renomeado' });
    expect(second).not.toBe(third);
  });

  it('não recria o admin quando já existe qualquer outro usuário, nem se o admin for removido', async () => {
    await emptyDatabase();
    const app = await boot();
    await createUser(app, { email: 'outro@e2e.test' });
    await app.dataSource.query(`DELETE FROM users WHERE role = 'admin'`);

    const again = await boot();

    const rows = await users(again);
    expect(rows.map((r) => r.email)).toEqual(['outro@e2e.test']);
  });

  it('usuário desativado também conta: com qualquer linha em users, nada é criado', async () => {
    await emptyDatabase();
    const app = await boot();
    await app.dataSource.query('DELETE FROM users');
    await createUser(app, { email: 'inativo@e2e.test', deactivated: true });

    const again = await boot();

    expect(await users(again)).toHaveLength(1);
  });
});
