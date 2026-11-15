import { TOKENS } from '../../src/core/tokens';
import { type AppE2e, bootstrapApp } from '../../src/runner/app-bootstrap';

type UserInfo = {
  sub: string;
  name: string;
  email: string | null;
  roles: string[];
  permissions: string[];
};

type ErrorBody = { statusCode: number; code: string; message: string };

const URL_USER_INFO = '/api/v1/auth/user-info';

describe('Autenticação e permissões (e2e)', () => {
  let e2e: AppE2e;

  beforeAll(async () => {
    e2e = await bootstrapApp();
  });

  afterAll(async () => {
    await e2e.close();
  });

  it('sem Authorization responde 401 UNAUTHENTICATED', async () => {
    const res = await e2e.client.get<ErrorBody>(URL_USER_INFO);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      statusCode: 401,
      code: 'UNAUTHENTICATED',
      message: 'Não autenticado.',
    });
  });

  it('token desconhecido responde 401 UNAUTHENTICATED', async () => {
    const res = await e2e.client.get<ErrorBody>(URL_USER_INFO, {
      token: 'token-que-nao-existe',
    });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('esquema diferente de Bearer responde 401', async () => {
    const res = await e2e.client.get<ErrorBody>(URL_USER_INFO, {
      headers: { authorization: `Basic ${TOKENS.editor}` },
    });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('editor recebe as cinco permissões', async () => {
    const res = await e2e.client.get<UserInfo>(URL_USER_INFO, {
      token: TOKENS.editor,
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      sub: 'e2e-editor',
      name: 'Editor E2E',
      email: 'editor@e2e.test',
      roles: ['content-brief-editor'],
      permissions: [
        'content-brief:read',
        'content-brief:write',
        'content-brief:delete',
        'registry:read',
        'registry:write',
      ],
    });
  });

  it('leitor recebe só as permissões de leitura', async () => {
    const res = await e2e.client.get<UserInfo>(URL_USER_INFO, {
      token: TOKENS.viewer,
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      roles: ['content-brief-viewer'],
      permissions: ['content-brief:read', 'registry:read'],
    });
  });

  it('usuário sem papel pauta-* recebe 200 com listas vazias', async () => {
    const res = await e2e.client.get<UserInfo>(URL_USER_INFO, {
      token: TOKENS.noRole,
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      sub: 'e2e-no-role',
      email: null,
      roles: [],
      permissions: [],
    });
  });

  it('/health continua público', async () => {
    const res = await e2e.client.get('/health');

    expect(res.status).toBe(200);
  });
});
