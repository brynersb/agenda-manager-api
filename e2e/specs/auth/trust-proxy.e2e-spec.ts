import { cleanDatabase } from '../../src/core/database';
import { createUser, LOGIN_URL } from '../../src/core/users';
import { type AppE2e, bootstrapApp } from '../../src/runner/app-bootstrap';

/**
 * O cliente de teste faz o papel do proxy confiável (1 salto): o IP do cliente
 * real é a última entrada do `X-Forwarded-For`, a que o proxy acrescentou.
 */
function login(
  e2e: AppE2e,
  forwardedFor: string,
  credentials: { email: string; password: string },
) {
  return e2e.client.post(LOGIN_URL, {
    headers: { 'x-forwarded-for': forwardedFor },
    body: credentials,
  });
}

function wrongLogin(e2e: AppE2e, email: string, forwardedFor: string) {
  return login(e2e, forwardedFor, { email, password: 'senha-errada-000' });
}

describe('TRUST_PROXY=1 usa o IP do X-Forwarded-For (e2e)', () => {
  let e2e: AppE2e;

  beforeAll(async () => {
    e2e = await bootstrapApp({
      env: { TRUST_PROXY: '1', LOGIN_THROTTLE_LIMIT_PER_MINUTE: '2' },
    });
  });

  beforeEach(async () => {
    await cleanDatabase(e2e.dataSource);
  });

  afterAll(async () => {
    await e2e.close();
  });

  it('o limite por IP separa clientes diferentes', async () => {
    const user = await createUser(e2e);

    const clientA = [];
    for (let i = 0; i < 3; i++) {
      clientA.push((await wrongLogin(e2e, user.email, '203.0.113.10')).status);
    }
    const clientB = (await wrongLogin(e2e, user.email, '203.0.113.20')).status;

    expect(clientA).toEqual([401, 401, 429]);
    // O cliente B tem o próprio balde: o limite do A não o atinge.
    expect(clientB).toBe(401);
  });

  it('só a última entrada (a do proxy) vale: o cliente não escapa do limite forjando a esquerda', async () => {
    const user = await createUser(e2e);
    const statuses: number[] = [];

    for (const forged of ['198.51.100.1', '198.51.100.2', '198.51.100.3']) {
      statuses.push(
        (await wrongLogin(e2e, user.email, `${forged}, 203.0.113.30`)).status,
      );
    }

    expect(statuses).toEqual([401, 401, 429]);
  });

  it('grava no refresh token o IP do cliente informado pelo proxy', async () => {
    const user = await createUser(e2e);

    const res = await login(e2e, '203.0.113.40', {
      email: user.email,
      password: user.password,
    });

    expect(res.status).toBe(200);
    const rows: { ip: string | null }[] = await e2e.dataSource.query(
      'SELECT ip FROM refresh_tokens WHERE user_id = $1',
      [user.id],
    );
    expect(rows).toEqual([{ ip: '203.0.113.40' }]);
  });

  it('um valor que não é IP no cabeçalho não quebra o login nem vai para o banco', async () => {
    const user = await createUser(e2e);

    const res = await login(e2e, 'x'.repeat(80), {
      email: user.email,
      password: user.password,
    });

    expect(res.status).toBe(200);
    const rows: { ip: string | null }[] = await e2e.dataSource.query(
      'SELECT ip FROM refresh_tokens WHERE user_id = $1',
      [user.id],
    );
    expect(rows).toEqual([{ ip: null }]);
  });
});
