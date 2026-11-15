import { createHash } from 'node:crypto';

import * as jwt from 'jsonwebtoken';

import { Role } from '@/modules/auth/domain/enums/role';
import { cleanDatabase } from '../../src/core/database';
import { forgeAccessToken } from '../../src/core/tokens';
import {
  CHANGE_PASSWORD_URL,
  createUser,
  E2E_PASSWORD,
  LOGIN_URL,
  LOGOUT_URL,
  login,
  loginAs,
  refresh,
  USER_INFO_URL,
} from '../../src/core/users';
import { type AppE2e, bootstrapApp } from '../../src/runner/app-bootstrap';

type ErrorBody = {
  statusCode: number;
  code: string;
  message: string;
  fields?: { field: string; message: string }[];
};

type UserInfo = {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
};

const ALL_PERMISSIONS = [
  'content-brief:read',
  'content-brief:write',
  'content-brief:delete',
  'registry:read',
  'registry:write',
  'user:read',
  'user:write',
];

describe('Autenticação própria (e2e)', () => {
  let e2e: AppE2e;

  beforeAll(async () => {
    e2e = await bootstrapApp();
  });

  afterAll(async () => {
    await e2e.close();
  });

  beforeEach(async () => {
    await cleanDatabase(e2e.dataSource);
    e2e.clock.setToday('2026-11-14');
  });

  const userInfo = (token?: string, headers?: Record<string, string>) =>
    e2e.client.get<UserInfo & ErrorBody>(USER_INFO_URL, { token, headers });

  const failedLogins = async (email: string, times: number) => {
    for (let i = 0; i < times; i++) {
      await login(e2e, { email, password: 'senha-errada-000' });
    }
  };

  describe('POST /auth/login', () => {
    it('devolve tokens, expiresIn, mustChangePassword e o usuário com permissões', async () => {
      const user = await createUser(e2e, {
        name: 'Maria Souza',
        email: 'maria@e2e.test',
        role: Role.Viewer,
      });

      const res = await login(e2e, user);

      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(res.body).toEqual({
        accessToken: expect.stringMatching(/^[\w-]+\.[\w-]+\.[\w-]+$/),
        refreshToken: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
        expiresIn: 900,
        mustChangePassword: false,
        user: {
          id: user.id,
          email: 'maria@e2e.test',
          name: 'Maria Souza',
          role: 'content-brief-viewer',
          permissions: ['content-brief:read', 'registry:read'],
        },
      });
    });

    it('o access token é HS256 com sub, email, name, role, iss, aud e nada mais', async () => {
      const user = await createUser(e2e, { role: Role.Editor });

      const session = await loginAs(e2e, user);

      const decoded = jwt.decode(session.accessToken, { complete: true });
      expect(decoded?.header.alg).toBe('HS256');
      expect(decoded?.payload).toEqual({
        sub: user.id,
        email: user.email,
        name: user.name,
        role: 'content-brief-editor',
        iss: 'pauta-mkt-api',
        aud: 'pauta-mkt',
        iat: expect.any(Number),
        exp: expect.any(Number),
      });
    });

    it('devolve permissões do admin (todas), do editor e do leitor', async () => {
      const admin = await createUser(e2e, { role: Role.Admin });
      const editor = await createUser(e2e, { role: Role.Editor });

      expect((await loginAs(e2e, admin)).user.permissions).toEqual(
        ALL_PERMISSIONS,
      );
      expect((await loginAs(e2e, editor)).user.permissions).toEqual([
        'content-brief:read',
        'content-brief:write',
        'content-brief:delete',
        'registry:read',
        'registry:write',
      ]);
    });

    it('ignora caixa e espaços no e-mail', async () => {
      const user = await createUser(e2e, { email: 'ana@e2e.test' });

      const res = await login(e2e, {
        email: '  ANA@E2E.test ',
        password: user.password,
      });

      expect(res.status).toBe(200);
    });

    it('indica mustChangePassword quando a senha é provisória', async () => {
      const user = await createUser(e2e, { mustChangePassword: true });

      expect((await loginAs(e2e, user)).mustChangePassword).toBe(true);
    });

    it('registra o último login e zera as falhas, sem mexer na versão', async () => {
      const user = await createUser(e2e);
      await failedLogins(user.email, 2);

      await loginAs(e2e, user);

      const [row] = await e2e.dataSource.query(
        'SELECT failed_login_attempts, last_login_at, version FROM users WHERE id = $1',
        [user.id],
      );
      expect(row.failed_login_attempts).toBe(0);
      expect(new Date(row.last_login_at).toISOString()).toBe(
        '2026-11-14T12:00:00.000Z',
      );
      expect(row.version).toBe(1);
    });

    it('guarda só o hash SHA-256 do refresh token, com 7 dias de validade', async () => {
      const user = await createUser(e2e);

      const session = await loginAs(e2e, user);

      const rows = await e2e.dataSource.query(
        'SELECT token_hash, expires_at, revoked_at, user_id FROM refresh_tokens',
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].token_hash).toBe(
        createHash('sha256').update(session.refreshToken).digest('hex'),
      );
      expect(rows[0].token_hash).not.toContain(session.refreshToken);
      expect(new Date(rows[0].expires_at).toISOString()).toBe(
        '2026-11-21T12:00:00.000Z',
      );
      expect(rows[0].revoked_at).toBeNull();
      expect(rows[0].user_id).toBe(user.id);
    });

    it('senha errada e e-mail inexistente dão a MESMA resposta 401 INVALID_CREDENTIALS', async () => {
      const user = await createUser(e2e);

      const wrongPassword = await login(e2e, {
        email: user.email,
        password: 'senha-errada-000',
      });
      const unknownEmail = await login(e2e, {
        email: 'ninguem@e2e.test',
        password: 'senha-errada-000',
      });

      expect(wrongPassword.status).toBe(401);
      expect(wrongPassword.body).toEqual({
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'E-mail ou senha inválidos.',
      });
      expect(unknownEmail.status).toBe(wrongPassword.status);
      expect(unknownEmail.body).toEqual(wrongPassword.body);
    });

    it('e-mail com formato inválido também é só "credenciais inválidas"', async () => {
      const res = await login(e2e, { email: 'sem-arroba', password: 'x' });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
    });

    it.each([
      [{}, ['email', 'password']],
      [{ email: 'a@b.co' }, ['password']],
      [{ email: 'a@b.co', password: 123 }, ['password']],
      [{ email: 'a@b.co', password: 'x'.repeat(129) }, ['password']],
    ])('corpo inválido %o dá 400 INVALID_REQUEST', async (body, fields) => {
      const res = await e2e.client.post<ErrorBody>(LOGIN_URL, { body });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_REQUEST');
      expect([...new Set(res.body.fields?.map((f) => f.field))].sort()).toEqual(
        [...fields].sort(),
      );
    });

    it('campo extra é recusado (whitelist)', async () => {
      const res = await e2e.client.post<ErrorBody>(LOGIN_URL, {
        body: { email: 'a@b.co', password: 'x', role: 'admin' },
      });

      expect(res.status).toBe(400);
    });

    it('nunca devolve hash nem senha', async () => {
      const user = await createUser(e2e);

      const res = await login(e2e, user);

      const text = JSON.stringify(res.body);
      expect(text).not.toContain('argon2');
      expect(text).not.toContain('passwordHash');
      expect(text).not.toContain(user.password);
    });
  });

  describe('bloqueio por tentativas', () => {
    it('5 falhas seguidas bloqueiam a conta: a 6ª tentativa, até com a senha certa, dá 403 ACCOUNT_LOCKED', async () => {
      const user = await createUser(e2e);

      await failedLogins(user.email, 4);
      const fifth = await login(e2e, {
        email: user.email,
        password: 'senha-errada-000',
      });
      const afterLock = await login(e2e, user);

      expect(fifth.status).toBe(401);
      expect(fifth.body.code).toBe('INVALID_CREDENTIALS');
      expect(afterLock.status).toBe(403);
      expect(afterLock.body).toEqual({
        statusCode: 403,
        code: 'ACCOUNT_LOCKED',
        message:
          'Conta bloqueada por excesso de tentativas. Tente novamente em 15 minutos.',
      });
    });

    it('destrava com o passar do tempo (15 min) e aceita a senha certa', async () => {
      const user = await createUser(e2e);
      await failedLogins(user.email, 5);

      e2e.clock.advanceMinutes(14);
      expect((await login(e2e, user)).status).toBe(403);

      e2e.clock.advanceMinutes(2);
      const res = await login(e2e, user);

      expect(res.status).toBe(200);
      const [row] = await e2e.dataSource.query(
        'SELECT failed_login_attempts, locked_until FROM users WHERE id = $1',
        [user.id],
      );
      expect(row.failed_login_attempts).toBe(0);
      expect(row.locked_until).toBeNull();
    });

    it('a mensagem informa os minutos que faltam', async () => {
      const user = await createUser(e2e);
      await failedLogins(user.email, 5);

      e2e.clock.advanceMinutes(10);
      const res = await login(e2e, user);

      expect(res.body.message).toContain('5 minutos');
    });

    it('depois do desbloqueio, novas falhas recomeçam a contagem do zero', async () => {
      const user = await createUser(e2e);
      await failedLogins(user.email, 5);
      e2e.clock.advanceMinutes(16);

      await failedLogins(user.email, 4);
      const stillOpen = await login(e2e, user);

      expect(stillOpen.status).toBe(200);
    });

    it('login com sucesso zera o contador: 4 falhas, sucesso e mais 4 falhas não bloqueiam', async () => {
      const user = await createUser(e2e);

      await failedLogins(user.email, 4);
      await loginAs(e2e, user);
      await failedLogins(user.email, 4);

      expect((await login(e2e, user)).status).toBe(200);
    });

    it('o bloqueio é por conta: outro usuário continua entrando', async () => {
      const blocked = await createUser(e2e);
      const other = await createUser(e2e);

      await failedLogins(blocked.email, 5);

      expect((await login(e2e, blocked)).status).toBe(403);
      expect((await login(e2e, other)).status).toBe(200);
    });

    it('tentativas simultâneas não escapam da contagem (atomicidade)', async () => {
      const user = await createUser(e2e);

      await Promise.all(
        Array.from({ length: 5 }, () =>
          login(e2e, { email: user.email, password: 'senha-errada-000' }),
        ),
      );

      expect((await login(e2e, user)).body.code).toBe('ACCOUNT_LOCKED');
    });

    it('e-mail inexistente nunca bloqueia nada nem muda de resposta', async () => {
      for (let i = 0; i < 7; i++) {
        const res = await login(e2e, {
          email: 'fantasma@e2e.test',
          password: 'senha-errada-000',
        });
        expect(res.body.code).toBe('INVALID_CREDENTIALS');
      }
    });
  });

  describe('usuário desativado', () => {
    it('com a senha certa recebe 403 USER_DEACTIVATED e nenhum token', async () => {
      const user = await createUser(e2e, { deactivated: true });

      const res = await login(e2e, user);

      expect(res.status).toBe(403);
      expect(res.body).toEqual({
        statusCode: 403,
        code: 'USER_DEACTIVATED',
        message: 'Usuário desativado. Procure um administrador.',
      });
      const count = await e2e.dataSource.query(
        'SELECT count(*)::int AS n FROM refresh_tokens',
      );
      expect(count[0].n).toBe(0);
    });

    it('com a senha errada não revela a desativação', async () => {
      const user = await createUser(e2e, { deactivated: true });

      const res = await login(e2e, {
        email: user.email,
        password: 'senha-errada-000',
      });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('POST /auth/refresh (rotação)', () => {
    it('devolve um novo par, revoga o token usado e mantém a família', async () => {
      const user = await createUser(e2e);
      const first = await loginAs(e2e, user);

      const res = await refresh(e2e, first.refreshToken);

      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(res.body.refreshToken).not.toBe(first.refreshToken);
      expect(res.body.expiresIn).toBe(900);
      expect(res.body.user).toEqual(first.user);

      const rows = await e2e.dataSource.query(
        'SELECT id, family_id, revoked_at, replaced_by_id FROM refresh_tokens ORDER BY created_at, id',
      );
      expect(rows).toHaveLength(2);
      expect(rows[0].family_id).toBe(rows[1].family_id);
      expect(
        rows.filter((r: { revoked_at: unknown }) => r.revoked_at),
      ).toHaveLength(1);
      const revoked = rows.find((r: { revoked_at: unknown }) => r.revoked_at);
      const active = rows.find((r: { revoked_at: unknown }) => !r.revoked_at);
      expect(revoked.replaced_by_id).toBe(active.id);
    });

    it('o novo access token funciona e o novo refresh token também roda', async () => {
      const user = await createUser(e2e);
      const first = await loginAs(e2e, user);

      const second = (await refresh(e2e, first.refreshToken)).body;
      const third = await refresh(e2e, second.refreshToken);

      expect((await userInfo(second.accessToken)).status).toBe(200);
      expect(third.status).toBe(200);
    });

    it('REUSO: apresentar um refresh token já usado dá 401 e derruba a família inteira', async () => {
      const user = await createUser(e2e);
      const first = await loginAs(e2e, user);
      const second = (await refresh(e2e, first.refreshToken)).body;

      const reuse = await refresh(e2e, first.refreshToken);
      const child = await refresh(e2e, second.refreshToken);

      expect(reuse.status).toBe(401);
      expect(reuse.body.code).toBe('INVALID_REFRESH_TOKEN');
      expect(child.status).toBe(401);
      expect(child.body.code).toBe('INVALID_REFRESH_TOKEN');
      const active = await e2e.dataSource.query(
        'SELECT 1 FROM refresh_tokens WHERE revoked_at IS NULL',
      );
      expect(active).toHaveLength(0);
    });

    it('o reuso derruba só a família afetada: outro login do mesmo usuário continua', async () => {
      const user = await createUser(e2e);
      const device1 = await loginAs(e2e, user);
      const device2 = await loginAs(e2e, user);
      await refresh(e2e, device1.refreshToken);

      await refresh(e2e, device1.refreshToken);

      expect((await refresh(e2e, device2.refreshToken)).status).toBe(200);
    });

    it('duas renovações simultâneas com o mesmo token: só uma vence e a família cai', async () => {
      const user = await createUser(e2e);
      const first = await loginAs(e2e, user);

      const results = await Promise.all([
        refresh(e2e, first.refreshToken),
        refresh(e2e, first.refreshToken),
      ]);

      expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
      const winner = results.find((r) => r.status === 200);
      expect((await refresh(e2e, winner?.body.refreshToken ?? '')).status).toBe(
        401,
      );
    });

    it('token desconhecido dá 401 INVALID_REFRESH_TOKEN', async () => {
      const res = await refresh(e2e, 'token-que-nunca-existiu');

      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({
        statusCode: 401,
        code: 'INVALID_REFRESH_TOKEN',
      });
    });

    it('refresh token expirado (7 dias) dá 401', async () => {
      const user = await createUser(e2e);
      const session = await loginAs(e2e, user);

      e2e.clock.setToday('2026-11-22');
      const res = await refresh(e2e, session.refreshToken);

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_REFRESH_TOKEN');
    });

    it('usuário desativado recebe 403 USER_DEACTIVATED e a família é revogada', async () => {
      const user = await createUser(e2e);
      const session = await loginAs(e2e, user);
      await e2e.dataSource.query(
        `UPDATE users SET status = 'DEACTIVATED' WHERE id = $1`,
        [user.id],
      );

      const res = await refresh(e2e, session.refreshToken);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('USER_DEACTIVATED');
      const active = await e2e.dataSource.query(
        'SELECT 1 FROM refresh_tokens WHERE revoked_at IS NULL',
      );
      expect(active).toHaveLength(0);
    });

    it('a renovação reflete o papel atual do banco', async () => {
      const user = await createUser(e2e, { role: Role.Viewer });
      const session = await loginAs(e2e, user);
      await e2e.dataSource.query(
        `UPDATE users SET role = 'admin' WHERE id = $1`,
        [user.id],
      );

      const res = await refresh(e2e, session.refreshToken);

      expect(res.body.user.role).toBe('admin');
      expect((await userInfo(res.body.accessToken)).body.permissions).toEqual(
        ALL_PERMISSIONS,
      );
      expect((await userInfo(session.accessToken)).body.role).toBe(
        'content-brief-viewer',
      );
    });

    it('é público (sem Authorization) e valida o corpo', async () => {
      const res = await e2e.client.post<ErrorBody>('/api/v1/auth/refresh', {
        body: {},
      });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_REQUEST');
    });
  });

  describe('POST /auth/logout', () => {
    it('responde 204 e revoga a família: o refresh token deixa de funcionar', async () => {
      const user = await createUser(e2e);
      const session = await loginAs(e2e, user);

      const res = await e2e.client.post(LOGOUT_URL, {
        token: session.accessToken,
        body: { refreshToken: session.refreshToken },
      });

      expect(res.status).toBe(204);
      expect((await refresh(e2e, session.refreshToken)).status).toBe(401);
    });

    it('revoga também os tokens já rotacionados da família', async () => {
      const user = await createUser(e2e);
      const first = await loginAs(e2e, user);
      const second = (await refresh(e2e, first.refreshToken)).body;

      await e2e.client.post(LOGOUT_URL, {
        token: second.accessToken,
        body: { refreshToken: second.refreshToken },
      });

      const active = await e2e.dataSource.query(
        'SELECT 1 FROM refresh_tokens WHERE revoked_at IS NULL',
      );
      expect(active).toHaveLength(0);
    });

    it('só encerra a sessão em questão: outro dispositivo continua logado', async () => {
      const user = await createUser(e2e);
      const device1 = await loginAs(e2e, user);
      const device2 = await loginAs(e2e, user);

      await e2e.client.post(LOGOUT_URL, {
        token: device1.accessToken,
        body: { refreshToken: device1.refreshToken },
      });

      expect((await refresh(e2e, device2.refreshToken)).status).toBe(200);
    });

    it('é idempotente: repetir ou mandar token desconhecido continua 204', async () => {
      const user = await createUser(e2e);
      const session = await loginAs(e2e, user);
      const body = { refreshToken: session.refreshToken };

      const first = await e2e.client.post(LOGOUT_URL, {
        token: session.accessToken,
        body,
      });
      const again = await e2e.client.post(LOGOUT_URL, {
        token: session.accessToken,
        body,
      });
      const unknown = await e2e.client.post(LOGOUT_URL, {
        token: session.accessToken,
        body: { refreshToken: 'desconhecido' },
      });

      expect([first.status, again.status, unknown.status]).toEqual([
        204, 204, 204,
      ]);
    });

    it('o access token de A não derruba a sessão de B', async () => {
      const a = await createUser(e2e);
      const b = await createUser(e2e);
      const sessionA = await loginAs(e2e, a);
      const sessionB = await loginAs(e2e, b);

      const res = await e2e.client.post(LOGOUT_URL, {
        token: sessionA.accessToken,
        body: { refreshToken: sessionB.refreshToken },
      });

      expect(res.status).toBe(204);
      expect((await refresh(e2e, sessionB.refreshToken)).status).toBe(200);
    });

    it('exige autenticação e corpo válido', async () => {
      const user = await createUser(e2e);
      const session = await loginAs(e2e, user);

      const noToken = await e2e.client.post<ErrorBody>(LOGOUT_URL, {
        body: { refreshToken: session.refreshToken },
      });
      const noBody = await e2e.client.post<ErrorBody>(LOGOUT_URL, {
        token: session.accessToken,
        body: {},
      });

      expect(noToken.status).toBe(401);
      expect(noBody.status).toBe(400);
    });
  });

  describe('POST /auth/change-password', () => {
    const change = (
      token: string,
      body: { currentPassword: string; newPassword: string },
    ) => e2e.client.post<ErrorBody>(CHANGE_PASSWORD_URL, { token, body });

    it('troca a senha: a antiga para de valer, a nova entra e mustChangePassword some', async () => {
      const user = await createUser(e2e, { mustChangePassword: true });
      const session = await loginAs(e2e, user);

      const res = await change(session.accessToken, {
        currentPassword: user.password,
        newPassword: 'nova-senha-forte-456',
      });

      expect(res.status).toBe(204);
      expect(await login(e2e, user).then((r) => r.status)).toBe(401);
      const relogin = await login(e2e, {
        email: user.email,
        password: 'nova-senha-forte-456',
      });
      expect(relogin.status).toBe(200);
      expect(relogin.body.mustChangePassword).toBe(false);
    });

    it('revoga TODOS os refresh tokens do usuário, de todas as sessões', async () => {
      const user = await createUser(e2e);
      const device1 = await loginAs(e2e, user);
      const device2 = await loginAs(e2e, user);

      await change(device1.accessToken, {
        currentPassword: user.password,
        newPassword: 'nova-senha-forte-456',
      });

      expect((await refresh(e2e, device1.refreshToken)).status).toBe(401);
      expect((await refresh(e2e, device2.refreshToken)).status).toBe(401);
    });

    it('não revoga os tokens de outros usuários', async () => {
      const user = await createUser(e2e);
      const other = await createUser(e2e);
      const session = await loginAs(e2e, user);
      const otherSession = await loginAs(e2e, other);

      await change(session.accessToken, {
        currentPassword: user.password,
        newPassword: 'nova-senha-forte-456',
      });

      expect((await refresh(e2e, otherSession.refreshToken)).status).toBe(200);
    });

    it('senha atual errada dá 400 INVALID_CURRENT_PASSWORD e nada muda', async () => {
      const user = await createUser(e2e);
      const session = await loginAs(e2e, user);

      const res = await change(session.accessToken, {
        currentPassword: 'senha-errada-000',
        newPassword: 'nova-senha-forte-456',
      });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_CURRENT_PASSWORD');
      expect((await login(e2e, user)).status).toBe(200);
      expect((await refresh(e2e, session.refreshToken)).status).toBe(200);
    });

    it.each([
      ['curta', 'curta'],
      ['igual à atual', E2E_PASSWORD],
      ['com 129 caracteres', 'x'.repeat(129)],
    ])('nova senha %s dá 400 WEAK_PASSWORD', async (_name, newPassword) => {
      const user = await createUser(e2e);
      const session = await loginAs(e2e, user);

      const res = await change(session.accessToken, {
        currentPassword: user.password,
        newPassword,
      });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('WEAK_PASSWORD');
    });

    it('exige autenticação e corpo válido', async () => {
      const user = await createUser(e2e);
      const session = await loginAs(e2e, user);

      const noToken = await e2e.client.post<ErrorBody>(CHANGE_PASSWORD_URL, {
        body: { currentPassword: 'a', newPassword: 'b' },
      });
      const noBody = await e2e.client.post<ErrorBody>(CHANGE_PASSWORD_URL, {
        token: session.accessToken,
        body: {},
      });

      expect(noToken.status).toBe(401);
      expect(noBody.status).toBe(400);
      expect(noBody.body.code).toBe('INVALID_REQUEST');
    });

    it('usuário desativado com access token ainda válido recebe 403 USER_DEACTIVATED', async () => {
      const user = await createUser(e2e);
      const session = await loginAs(e2e, user);
      await e2e.dataSource.query(
        `UPDATE users SET status = 'DEACTIVATED' WHERE id = $1`,
        [user.id],
      );

      const res = await change(session.accessToken, {
        currentPassword: user.password,
        newPassword: 'nova-senha-forte-456',
      });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('USER_DEACTIVATED');
    });
  });

  describe('GET /auth/user-info', () => {
    it.each([
      [Role.Admin, 'admin', ALL_PERMISSIONS],
      [
        Role.Editor,
        'content-brief-editor',
        [
          'content-brief:read',
          'content-brief:write',
          'content-brief:delete',
          'registry:read',
          'registry:write',
        ],
      ],
      [
        Role.Viewer,
        'content-brief-viewer',
        ['content-brief:read', 'registry:read'],
      ],
    ])(
      '%s recebe { id, email, name, role, permissions }',
      async (role, roleName, permissions) => {
        const user = await createUser(e2e, {
          role,
          name: 'Fulana',
          email: 'fulana@e2e.test',
        });
        const session = await loginAs(e2e, user);

        const res = await userInfo(session.accessToken);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
          id: user.id,
          email: 'fulana@e2e.test',
          name: 'Fulana',
          role: roleName,
          permissions,
        });
      },
    );

    it('o contrato antigo (sub, roles) não existe mais', async () => {
      const user = await createUser(e2e);
      const session = await loginAs(e2e, user);

      const res = await userInfo(session.accessToken);

      expect(res.body).not.toHaveProperty('sub');
      expect(res.body).not.toHaveProperty('roles');
    });

    it('não consulta o banco: continua valendo com o usuário removido da tabela', async () => {
      const user = await createUser(e2e);
      const session = await loginAs(e2e, user);
      await e2e.dataSource.query('DELETE FROM refresh_tokens');
      await e2e.dataSource.query('DELETE FROM users');

      expect((await userInfo(session.accessToken)).status).toBe(200);
    });

    it('usuário desativado mantém o acesso só até o access token expirar (documentado)', async () => {
      const user = await createUser(e2e);
      const session = await loginAs(e2e, user);
      await e2e.dataSource.query(
        `UPDATE users SET status = 'DEACTIVATED' WHERE id = $1`,
        [user.id],
      );

      expect((await userInfo(session.accessToken)).status).toBe(200);
    });

    describe('tokens inválidos dão 401 UNAUTHENTICATED', () => {
      const expected = {
        statusCode: 401,
        code: 'UNAUTHENTICATED',
        message: 'Não autenticado.',
      };

      it('sem Authorization', async () => {
        const res = await userInfo();

        expect(res.status).toBe(401);
        expect(res.body).toEqual(expected);
      });

      it('esquema Basic em vez de Bearer', async () => {
        const res = await userInfo(undefined, {
          authorization: `Basic ${forgeAccessToken()}`,
        });

        expect(res.status).toBe(401);
        expect(res.body.code).toBe('UNAUTHENTICATED');
      });

      it('lixo no lugar do token', async () => {
        const res = await userInfo('isto-nao-e-um-jwt');

        expect(res.status).toBe(401);
        expect(res.body).toEqual(expected);
      });

      it('token adulterado (assinatura alterada)', async () => {
        const user = await createUser(e2e);
        const { accessToken } = await loginAs(e2e, user);
        const tampered = `${accessToken.slice(0, -4)}AAAA`;

        const res = await userInfo(tampered);

        expect(res.status).toBe(401);
        expect(res.body).toEqual(expected);
      });

      it('payload adulterado para virar admin (assinatura original)', async () => {
        const user = await createUser(e2e, { role: Role.Viewer });
        const { accessToken } = await loginAs(e2e, user);
        const [header, payload, signature] = accessToken.split('.');
        const forged = Buffer.from(
          JSON.stringify({
            ...JSON.parse(Buffer.from(payload, 'base64url').toString()),
            role: 'admin',
          }),
        ).toString('base64url');

        const res = await userInfo(`${header}.${forged}.${signature}`);

        expect(res.status).toBe(401);
      });

      it('token expirado', async () => {
        const res = await userInfo(forgeAccessToken({ expiresIn: -60 }));

        expect(res.status).toBe(401);
        expect(res.body).toEqual(expected);
      });

      it('assinado com outro segredo', async () => {
        const res = await userInfo(
          forgeAccessToken({
            secret: 'um-outro-segredo-com-mais-de-32-caracteres',
          }),
        );

        expect(res.status).toBe(401);
      });

      it('issuer ou audience diferentes', async () => {
        expect(
          (await userInfo(forgeAccessToken({ issuer: 'outro-emissor' })))
            .status,
        ).toBe(401);
        expect(
          (await userInfo(forgeAccessToken({ audience: 'outra-audiencia' })))
            .status,
        ).toBe(401);
      });

      it('papel desconhecido', async () => {
        expect(
          (await userInfo(forgeAccessToken({ role: 'superuser' }))).status,
        ).toBe(401);
      });

      it('alg none', async () => {
        const header = Buffer.from(
          JSON.stringify({ alg: 'none', typ: 'JWT' }),
        ).toString('base64url');
        const now = Math.floor(Date.now() / 1000);
        const payload = Buffer.from(
          JSON.stringify({
            sub: 'x',
            email: 'x@y.z',
            name: 'X',
            role: 'admin',
            iss: 'pauta-mkt-api',
            aud: 'pauta-mkt',
            exp: now + 900,
          }),
        ).toString('base64url');

        const res = await userInfo(`${header}.${payload}.`);

        expect(res.status).toBe(401);
      });

      it('refresh token usado como access token', async () => {
        const user = await createUser(e2e);
        const session = await loginAs(e2e, user);

        const res = await userInfo(session.refreshToken);

        expect(res.status).toBe(401);
      });
    });
  });

  it('/health continua público', async () => {
    const res = await e2e.client.get('/health');

    expect(res.status).toBe(200);
  });

  it('login e refresh são os únicos endpoints de auth públicos', async () => {
    const logout = await e2e.client.post(LOGOUT_URL, {
      body: { refreshToken: 'x' },
    });
    const change = await e2e.client.post(CHANGE_PASSWORD_URL, {
      body: { currentPassword: 'x', newPassword: 'y' },
    });

    expect(logout.status).toBe(401);
    expect(change.status).toBe(401);
  });

  it('o corpo de erro do login nunca ecoa a senha enviada', async () => {
    const res = await e2e.client.post<unknown>(LOGIN_URL, {
      body: { email: 'a@b.co', password: 'senha-super-secreta-xyz' },
    });

    expect(JSON.stringify(res.body)).not.toContain('senha-super-secreta-xyz');
  });
});
