import { Role } from '@/modules/auth/domain/enums/role';
import { cleanDatabase } from '../../src/core/database';
import { forgeAccessToken, TOKENS } from '../../src/core/tokens';
import { createUser, loginAs } from '../../src/core/users';
import { type AppE2e, bootstrapApp } from '../../src/runner/app-bootstrap';

type Endpoint = {
  name: string;
  method: 'get' | 'post' | 'delete';
  path: string;
  body?: unknown;
  /** Permissão exigida, para o título do teste. */
  permission: string;
  /** Status quando o papel TEM a permissão (a rota usa ids inexistentes: o 404/400 prova que passou da autorização). */
  allowed: number;
  roles: { admin: boolean; editor: boolean; viewer: boolean };
};

const MISSING_ID = '0192f6a0-7c1e-7a3b-9d52-4f1e8b6c2a10';

/** Rotas representativas de cada permissão. `allowed` é o status de quem passa na autorização. */
const ENDPOINTS: Endpoint[] = [
  {
    name: 'GET /content-briefs',
    method: 'get',
    path: '/api/v1/content-briefs',
    permission: 'content-brief:read',
    allowed: 200,
    roles: { admin: true, editor: true, viewer: true },
  },
  {
    name: 'GET /content-briefs/summary',
    method: 'get',
    path: '/api/v1/content-briefs/summary',
    permission: 'content-brief:read',
    allowed: 200,
    roles: { admin: true, editor: true, viewer: true },
  },
  {
    name: 'POST /content-briefs',
    method: 'post',
    path: '/api/v1/content-briefs',
    body: { title: 'Pauta da matriz' },
    permission: 'content-brief:write',
    allowed: 201,
    roles: { admin: true, editor: true, viewer: false },
  },
  {
    name: 'DELETE /content-briefs/:id',
    method: 'delete',
    path: `/api/v1/content-briefs/${MISSING_ID}`,
    permission: 'content-brief:delete',
    allowed: 404,
    roles: { admin: true, editor: true, viewer: false },
  },
  {
    name: 'GET /owners',
    method: 'get',
    path: '/api/v1/owners',
    permission: 'registry:read',
    allowed: 200,
    roles: { admin: true, editor: true, viewer: true },
  },
  {
    name: 'POST /owners',
    method: 'post',
    path: '/api/v1/owners',
    body: { name: 'Responsável da matriz' },
    permission: 'registry:write',
    allowed: 201,
    roles: { admin: true, editor: true, viewer: false },
  },
  {
    name: 'GET /estate-developments',
    method: 'get',
    path: '/api/v1/estate-developments',
    permission: 'registry:read',
    allowed: 200,
    roles: { admin: true, editor: true, viewer: true },
  },
  {
    name: 'POST /estate-developments',
    method: 'post',
    path: '/api/v1/estate-developments',
    body: { name: 'Empreendimento da matriz' },
    permission: 'registry:write',
    allowed: 201,
    roles: { admin: true, editor: true, viewer: false },
  },
  {
    name: 'GET /users',
    method: 'get',
    path: '/api/v1/users',
    permission: 'user:read',
    allowed: 200,
    roles: { admin: true, editor: false, viewer: false },
  },
  {
    name: 'GET /users/:id',
    method: 'get',
    path: `/api/v1/users/${MISSING_ID}`,
    permission: 'user:read',
    allowed: 404,
    roles: { admin: true, editor: false, viewer: false },
  },
  {
    name: 'POST /users',
    method: 'post',
    path: '/api/v1/users',
    body: {
      name: 'Novo da matriz',
      email: 'matriz@e2e.test',
      role: 'content-brief-viewer',
    },
    permission: 'user:write',
    allowed: 201,
    roles: { admin: true, editor: false, viewer: false },
  },
  {
    name: 'POST /users/:id/deactivate',
    method: 'post',
    path: `/api/v1/users/${MISSING_ID}/deactivate`,
    permission: 'user:write',
    allowed: 404,
    roles: { admin: true, editor: false, viewer: false },
  },
  {
    name: 'POST /users/:id/reset-password',
    method: 'post',
    path: `/api/v1/users/${MISSING_ID}/reset-password`,
    permission: 'user:write',
    allowed: 404,
    roles: { admin: true, editor: false, viewer: false },
  },
];

describe('Matriz de permissões por papel (e2e)', () => {
  let e2e: AppE2e;

  beforeAll(async () => {
    e2e = await bootstrapApp();
  });

  afterAll(async () => {
    await e2e.close();
  });

  beforeEach(async () => {
    await cleanDatabase(e2e.dataSource);
  });

  const call = (endpoint: Endpoint, token?: string) =>
    e2e.client[endpoint.method]<{ code?: string }>(endpoint.path, {
      token,
      body: endpoint.body,
    });

  describe.each(ENDPOINTS)('$name ($permission)', (endpoint) => {
    it.each([
      ['admin', 'admin' as const],
      ['editor', 'editor' as const],
      ['viewer', 'viewer' as const],
    ])('papel %s', async (_label, role) => {
      const res = await call(endpoint, TOKENS[role]);

      if (endpoint.roles[role]) {
        expect(res.status).toBe(endpoint.allowed);
      } else {
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('FORBIDDEN');
      }
    });

    it('sem token dá 401 UNAUTHENTICATED', async () => {
      const res = await call(endpoint);

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHENTICATED');
    });

    it('token adulterado dá 401', async () => {
      const res = await call(endpoint, `${TOKENS.admin.slice(0, -4)}AAAA`);

      expect(res.status).toBe(401);
    });

    it('token expirado dá 401', async () => {
      const res = await call(
        endpoint,
        forgeAccessToken({ role: Role.Admin, expiresIn: -10 }),
      );

      expect(res.status).toBe(401);
    });

    it('papel desconhecido dá 401', async () => {
      const res = await call(endpoint, TOKENS.unknownRole);

      expect(res.status).toBe(401);
    });
  });

  it('a decisão vem do papel no servidor: o token de um leitor real não ganha permissão', async () => {
    const viewer = await createUser(e2e, { role: Role.Viewer });
    const session = await loginAs(e2e, viewer);

    const res = await e2e.client.post('/api/v1/owners', {
      token: session.accessToken,
      body: { name: 'Tentativa' },
    });

    expect(res.status).toBe(403);
  });

  it('rota inexistente com token válido continua 404', async () => {
    const res = await e2e.client.get('/api/v1/nao-existe', {
      token: TOKENS.admin,
    });

    expect(res.status).toBe(404);
  });
});
