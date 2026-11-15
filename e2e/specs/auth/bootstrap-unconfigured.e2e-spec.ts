import { cleanDatabase } from '../../src/core/database';
import { login } from '../../src/core/users';
import { type AppE2e, bootstrapApp } from '../../src/runner/app-bootstrap';

describe('Bootstrap sem BOOTSTRAP_ADMIN_* (e2e)', () => {
  let e2e: AppE2e | undefined;

  afterAll(async () => {
    await e2e?.close();
  });

  it('sem usuários e sem as variáveis, o app sobe, não cria ninguém e ninguém consegue entrar', async () => {
    const first = await bootstrapApp();
    await cleanDatabase(first.dataSource);
    await first.close();

    e2e = await bootstrapApp();

    const rows = await e2e.dataSource.query('SELECT 1 FROM users');
    expect(rows).toHaveLength(0);
    const res = await login(e2e, {
      email: 'admin@pauta.local',
      password: 'qualquer-senha-123',
    });
    expect(res.status).toBe(401);
    const health = await e2e.client.get('/health');
    expect(health.status).toBe(200);
  });
});
