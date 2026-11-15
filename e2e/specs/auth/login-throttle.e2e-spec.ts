import { TOKENS } from '../../src/core/tokens';
import {
  CHANGE_PASSWORD_URL,
  createUser,
  login,
  refresh,
  USER_INFO_URL,
} from '../../src/core/users';
import { type AppE2e, bootstrapApp } from '../../src/runner/app-bootstrap';

type ErrorBody = { statusCode: number; code: string; message: string };

describe('Limite de requisições por IP no login (e2e)', () => {
  let e2e: AppE2e;

  beforeAll(async () => {
    e2e = await bootstrapApp({
      env: { LOGIN_THROTTLE_LIMIT_PER_MINUTE: '4' },
    });
  });

  afterAll(async () => {
    await e2e.close();
  });

  it('o login responde 429 TOO_MANY_REQUESTS depois do limite mais baixo', async () => {
    const user = await createUser(e2e);
    const statuses: number[] = [];
    let last: ErrorBody | undefined;

    for (let i = 0; i < 6; i++) {
      const res = await login(e2e, {
        email: user.email,
        password: 'senha-errada-000',
      });
      statuses.push(res.status);
      last = res.body as unknown as ErrorBody;
    }

    expect(statuses).toEqual([401, 401, 401, 401, 429, 429]);
    expect(last).toEqual({
      statusCode: 429,
      code: 'TOO_MANY_REQUESTS',
      message: 'Muitas requisições. Tente novamente em instantes.',
    });
  });

  it('a troca de senha tem o mesmo limite baixo', async () => {
    const statuses: number[] = [];

    for (let i = 0; i < 6; i++) {
      const res = await e2e.client.post(CHANGE_PASSWORD_URL, {
        token: TOKENS.editor,
        body: { currentPassword: 'x', newPassword: 'y' },
      });
      statuses.push(res.status);
    }

    expect(statuses.slice(0, 4)).not.toContain(429);
    expect(statuses.slice(4)).toEqual([429, 429]);
  });

  it('as demais rotas só estão sujeitas ao limite global, bem mais alto', async () => {
    const statuses: number[] = [];

    for (let i = 0; i < 8; i++) {
      statuses.push(
        (await e2e.client.get(USER_INFO_URL, { token: TOKENS.editor })).status,
      );
    }
    for (let i = 0; i < 8; i++) {
      statuses.push((await refresh(e2e, 'token-qualquer')).status);
    }

    expect(statuses.slice(0, 8)).toEqual(Array(8).fill(200));
    expect(statuses.slice(8)).toEqual(Array(8).fill(401));
  });
});
