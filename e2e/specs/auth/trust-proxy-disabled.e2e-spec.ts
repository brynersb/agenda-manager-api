import { cleanDatabase } from '../../src/core/database';
import { createUser, LOGIN_URL } from '../../src/core/users';
import { type AppE2e, bootstrapApp } from '../../src/runner/app-bootstrap';

/** Login com senha errada, como se viesse de um proxy que informou `forwardedFor`. */
function wrongLogin(e2e: AppE2e, email: string, forwardedFor: string) {
  return e2e.client.post(LOGIN_URL, {
    headers: { 'x-forwarded-for': forwardedFor },
    body: { email, password: 'senha-errada-000' },
  });
}

describe('Sem TRUST_PROXY o X-Forwarded-For é ignorado (e2e)', () => {
  let e2e: AppE2e;

  beforeAll(async () => {
    // Limite 4 por IP. O primeiro teste gasta 1 requisição do mesmo IP (o do
    // próprio cliente de teste), então o segundo tem 3 antes do 429.
    e2e = await bootstrapApp({
      env: { TRUST_PROXY: 'false', LOGIN_THROTTLE_LIMIT_PER_MINUTE: '4' },
    });
  });

  beforeEach(async () => {
    await cleanDatabase(e2e.dataSource);
  });

  afterAll(async () => {
    await e2e.close();
  });

  it('o IP gravado no refresh token é o da conexão, não o do cabeçalho', async () => {
    const user = await createUser(e2e);

    const res = await e2e.client.post(LOGIN_URL, {
      headers: { 'x-forwarded-for': '203.0.113.7' },
      body: { email: user.email, password: user.password },
    });

    expect(res.status).toBe(200);
    const rows: { ip: string | null }[] = await e2e.dataSource.query(
      'SELECT ip FROM refresh_tokens WHERE user_id = $1',
      [user.id],
    );
    expect(rows).toEqual([{ ip: '127.0.0.1' }]);
  });

  it('clientes com X-Forwarded-For diferentes dividem o mesmo limite por IP', async () => {
    const user = await createUser(e2e);
    const statuses: number[] = [];

    for (const forwardedFor of [
      '203.0.113.1',
      '203.0.113.2',
      '203.0.113.3',
      '203.0.113.4',
    ]) {
      statuses.push((await wrongLogin(e2e, user.email, forwardedFor)).status);
    }

    // Se o cabeçalho valesse, cada IP teria o próprio limite e nenhum daria 429.
    expect(statuses).toEqual([401, 401, 401, 429]);
  });
});
