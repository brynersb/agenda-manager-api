import { Role } from '@/modules/auth/domain/enums/role';
import {
  USER_REPOSITORY,
  type UserRepositoryInterface,
} from '@/modules/user/application/interfaces/repositories/user.repository.interface';
import { LastAdminError } from '@/modules/user/domain/errors/user.errors';
import { cleanDatabase } from '../../src/core/database';
import { TOKENS } from '../../src/core/tokens';
import {
  CHANGE_PASSWORD_URL,
  type CreatedUser,
  createUser,
  login,
  loginAs,
  refresh,
  USER_INFO_URL,
} from '../../src/core/users';
import { type AppE2e, bootstrapApp } from '../../src/runner/app-bootstrap';

type UserBody = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  mustChangePassword: boolean;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  version: number;
  createdAt: string;
  createdBy: { id: string; name: string | null };
  updatedAt: string;
  updatedBy: { id: string; name: string | null };
};

type WithPassword = { user: UserBody; temporaryPassword: string | null };
type Page = { data: UserBody[]; total: number; page: number; limit: number };
type ErrorBody = {
  statusCode: number;
  code: string;
  message: string;
  fields?: { field: string; message: string }[];
};

const URL = '/api/v1/users';
const MISSING_ID = '0192f6a0-7c1e-7a3b-9d52-4f1e8b6c2a10';

describe('Administração de usuários (e2e)', () => {
  let e2e: AppE2e;
  let admin: CreatedUser;
  let adminToken: string;

  beforeAll(async () => {
    e2e = await bootstrapApp();
  });

  afterAll(async () => {
    await e2e.close();
  });

  beforeEach(async () => {
    await cleanDatabase(e2e.dataSource);
    e2e.clock.setToday('2026-11-14');
    admin = await createUser(e2e, { role: Role.Admin, name: 'Admin Real' });
    adminToken = (await loginAs(e2e, admin)).accessToken;
  });

  const create = (body: unknown, token: string = adminToken) =>
    e2e.client.post<WithPassword & ErrorBody>(URL, { token, body });
  const findOne = (id: string, token: string = adminToken) =>
    e2e.client.get<UserBody & ErrorBody>(`${URL}/${id}`, { token });
  const list = (query = '', token: string = adminToken) =>
    e2e.client.get<Page & ErrorBody>(`${URL}${query}`, { token });
  const patch = (id: string, body: unknown, token: string = adminToken) =>
    e2e.client.patch<UserBody & ErrorBody>(`${URL}/${id}`, { token, body });
  const action = (
    id: string,
    name: 'deactivate' | 'reactivate' | 'reset-password',
    token: string = adminToken,
  ) =>
    e2e.client.post<UserBody & WithPassword & ErrorBody>(
      `${URL}/${id}/${name}`,
      { token },
    );

  describe('POST /users', () => {
    it('sem senha gera uma provisória forte, devolvida uma única vez, com troca obrigatória', async () => {
      const res = await create({
        name: 'Maria Souza',
        email: 'Maria.Souza@E2E.test',
        role: 'content-brief-editor',
      });

      expect(res.status).toBe(201);
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(res.body.temporaryPassword).toMatch(/^.{16}$/);
      expect(res.body.user).toEqual({
        id: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        ),
        name: 'Maria Souza',
        email: 'maria.souza@e2e.test',
        role: 'content-brief-editor',
        status: 'ACTIVE',
        mustChangePassword: true,
        lockedUntil: null,
        lastLoginAt: null,
        version: 1,
        createdAt: '2026-11-14T12:00:00.000Z',
        createdBy: { id: admin.id, name: 'Admin Real' },
        updatedAt: '2026-11-14T12:00:00.000Z',
        updatedBy: { id: admin.id, name: 'Admin Real' },
      });
    });

    it('a senha provisória permite entrar (com mustChangePassword) e depois trocar', async () => {
      const created = await create({
        name: 'Maria',
        email: 'maria@e2e.test',
        role: 'content-brief-viewer',
      });
      const temporary = created.body.temporaryPassword ?? '';

      const first = await login(e2e, {
        email: 'maria@e2e.test',
        password: temporary,
      });
      expect(first.status).toBe(200);
      expect(first.body.mustChangePassword).toBe(true);

      const changed = await e2e.client.post(CHANGE_PASSWORD_URL, {
        token: first.body.accessToken,
        body: {
          currentPassword: temporary,
          newPassword: 'minha-senha-definitiva-1',
        },
      });
      expect(changed.status).toBe(204);

      const second = await login(e2e, {
        email: 'maria@e2e.test',
        password: 'minha-senha-definitiva-1',
      });
      expect(second.status).toBe(200);
      expect(second.body.mustChangePassword).toBe(false);
    });

    it('guarda argon2id no banco e nunca a senha provisória', async () => {
      const created = await create({
        name: 'Maria',
        email: 'maria@e2e.test',
        role: 'content-brief-viewer',
      });

      const [row] = await e2e.dataSource.query(
        'SELECT password_hash FROM users WHERE id = $1',
        [created.body.user.id],
      );
      expect(row.password_hash).toMatch(/^\$argon2id\$/);
      expect(row.password_hash).not.toContain(
        created.body.temporaryPassword ?? 'x',
      );
    });

    it('com senha informada não devolve senha, mas exige a troca', async () => {
      const res = await create({
        name: 'João',
        email: 'joao@e2e.test',
        role: 'content-brief-viewer',
        password: 'senha-do-admin-123',
      });

      expect(res.status).toBe(201);
      expect(res.body.temporaryPassword).toBeNull();
      expect(res.body.user.mustChangePassword).toBe(true);
      const session = await login(e2e, {
        email: 'joao@e2e.test',
        password: 'senha-do-admin-123',
      });
      expect(session.status).toBe(200);
      expect(session.body.mustChangePassword).toBe(true);
    });

    it('e-mail duplicado (qualquer caixa) dá 409 EMAIL_ALREADY_REGISTERED', async () => {
      await create({ name: 'A', email: 'dup@e2e.test', role: 'admin' });

      const res = await create({
        name: 'B',
        email: 'DUP@e2e.test',
        role: 'content-brief-viewer',
      });

      expect(res.status).toBe(409);
      expect(res.body).toEqual({
        statusCode: 409,
        code: 'EMAIL_ALREADY_REGISTERED',
        message: 'Já existe um usuário com este e-mail.',
      });
    });

    it('e-mail de usuário desativado também conta como duplicado', async () => {
      await createUser(e2e, { email: 'velho@e2e.test', deactivated: true });

      const res = await create({
        name: 'Novo',
        email: 'velho@e2e.test',
        role: 'content-brief-viewer',
      });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('EMAIL_ALREADY_REGISTERED');
    });

    it('duas criações simultâneas do mesmo e-mail: só uma vence', async () => {
      const body = {
        name: 'Corrida',
        email: 'corrida@e2e.test',
        role: 'content-brief-viewer',
      };

      const results = await Promise.all([create(body), create(body)]);

      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      const rows = await e2e.dataSource.query(
        `SELECT 1 FROM users WHERE email = 'corrida@e2e.test'`,
      );
      expect(rows).toHaveLength(1);
    });

    it.each([
      [{ name: 'A', email: 'sem-arroba', role: 'admin' }, 'INVALID_EMAIL'],
      [
        { name: '   ', email: 'a@e2e.test', role: 'admin' },
        'INVALID_USER_NAME',
      ],
      [
        { name: 'A', email: 'a@e2e.test', role: 'admin', password: 'curta' },
        'WEAK_PASSWORD',
      ],
      [
        {
          name: 'A',
          email: 'a@e2e.test',
          role: 'admin',
          password: 'x'.repeat(129),
        },
        'WEAK_PASSWORD',
      ],
      [{ name: 'A', email: 'a@e2e.test', role: 'chefe' }, 'INVALID_REQUEST'],
      [{ name: 'A', email: 'a@e2e.test' }, 'INVALID_REQUEST'],
      [
        { name: 'A', email: 'a@e2e.test', role: 'admin', status: 'ACTIVE' },
        'INVALID_REQUEST',
      ],
    ])('corpo %o dá 400 %s', async (body, code) => {
      const res = await create(body);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(code);
      const rows = await e2e.dataSource.query(
        `SELECT 1 FROM users WHERE email = 'a@e2e.test'`,
      );
      expect(rows).toHaveLength(0);
    });
  });

  describe('GET /users', () => {
    it('devolve { data, total, page, limit } ordenado por nome, sem hash nem token', async () => {
      await createUser(e2e, { name: 'Zélia', email: 'zelia@e2e.test' });
      await createUser(e2e, { name: 'Ana', email: 'ana@e2e.test' });

      const res = await list();

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ total: 3, page: 1, limit: 50 });
      expect(res.body.data.map((u) => u.name)).toEqual([
        'Admin Real',
        'Ana',
        'Zélia',
      ]);
      const text = JSON.stringify(res.body);
      expect(text).not.toContain('argon2');
      expect(text).not.toContain('passwordHash');
      expect(text).not.toContain('password_hash');
      expect(text).not.toContain('failedLoginAttempts');
    });

    it('pagina com page e limit', async () => {
      for (const n of ['b', 'c', 'd', 'e']) {
        await createUser(e2e, { name: `Pessoa ${n}`, email: `${n}@e2e.test` });
      }

      const page2 = await list('?page=2&limit=2');
      const beyond = await list('?page=9&limit=2');

      expect(page2.body).toMatchObject({ total: 5, page: 2, limit: 2 });
      expect(page2.body.data).toHaveLength(2);
      expect(beyond.status).toBe(200);
      expect(beyond.body.data).toEqual([]);
      expect(beyond.body.total).toBe(5);
    });

    it('busca por nome ou e-mail sem caixa e sem acento', async () => {
      await createUser(e2e, { name: 'José Álvares', email: 'jose@e2e.test' });
      await createUser(e2e, { name: 'Outra', email: 'procurado@e2e.test' });

      expect((await list('?q=ALVARES')).body.data.map((u) => u.name)).toEqual([
        'José Álvares',
      ]);
      expect((await list('?q=procurado')).body.data.map((u) => u.name)).toEqual(
        ['Outra'],
      );
      expect((await list('?q=nao-existe')).body).toMatchObject({
        data: [],
        total: 0,
      });
    });

    it('o texto da busca é literal: % e _ não viram curinga', async () => {
      await createUser(e2e, { name: 'Cem por cento', email: 'a@e2e.test' });

      expect((await list('?q=%25')).body.total).toBe(0);
      expect((await list('?q=_')).body.total).toBe(0);
    });

    it('filtra por status', async () => {
      await createUser(e2e, { name: 'Inativo', deactivated: true });

      const active = await list('?status=ACTIVE');
      const deactivated = await list('?status=DEACTIVATED');

      expect(active.body.data.map((u) => u.name)).toEqual(['Admin Real']);
      expect(deactivated.body.data.map((u) => u.name)).toEqual(['Inativo']);
    });

    it.each([
      '?status=pendente',
      '?limit=0',
      '?limit=201',
      '?page=0',
      `?q=${'x'.repeat(101)}`,
    ])('parâmetro inválido %s dá 400', async (query) => {
      const res = await list(query);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_REQUEST');
    });
  });

  describe('GET /users/:id', () => {
    it('devolve o usuário', async () => {
      const res = await findOne(admin.id);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: admin.id,
        email: admin.email,
        role: 'admin',
      });
    });

    it('inexistente dá 404 USER_NOT_FOUND e id malformado dá 400', async () => {
      const missing = await findOne(MISSING_ID);
      const bad = await findOne('nao-e-uuid');

      expect(missing.status).toBe(404);
      expect(missing.body.code).toBe('USER_NOT_FOUND');
      expect(bad.status).toBe(400);
    });

    it('a data de bloqueio aparece depois de 5 falhas de login', async () => {
      const target = await createUser(e2e);
      for (let i = 0; i < 5; i++) {
        await login(e2e, { email: target.email, password: 'errada-0000000' });
      }

      const res = await findOne(target.id);

      expect(res.body.lockedUntil).toBe('2026-11-14T12:15:00.000Z');
    });

    it('login e falha de login não mudam a versão nem a auditoria', async () => {
      const target = await createUser(e2e);
      const before = await findOne(target.id);

      await login(e2e, { email: target.email, password: 'errada-0000000' });
      await loginAs(e2e, target);
      const after = await findOne(target.id);

      expect(after.body.version).toBe(before.body.version);
      expect(after.body.updatedAt).toBe(before.body.updatedAt);
      expect(after.body.lastLoginAt).toBe('2026-11-14T12:00:00.000Z');
    });
  });

  describe('PATCH /users/:id', () => {
    it('altera nome e papel, sobe a versão e audita quem alterou', async () => {
      const target = await createUser(e2e, { role: Role.Viewer });

      const res = await patch(target.id, {
        name: '  Novo   Nome ',
        role: 'content-brief-editor',
        version: 1,
      });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        name: 'Novo Nome',
        role: 'content-brief-editor',
        version: 2,
        updatedBy: { id: admin.id, name: 'Admin Real' },
        createdBy: { id: 'e2e-setup', name: 'Setup E2E' },
      });
    });

    it('o papel novo vale no próximo login/refresh e muda as permissões', async () => {
      const target = await createUser(e2e, { role: Role.Viewer });
      const session = await loginAs(e2e, target);

      await patch(target.id, { role: 'admin', version: 1 });
      const renewed = await refresh(e2e, session.refreshToken);

      expect(renewed.body.user.role).toBe('admin');
      expect(renewed.body.user.permissions).toContain('user:write');
    });

    it('altera só o nome mantendo o papel', async () => {
      const target = await createUser(e2e, { role: Role.Editor });

      const res = await patch(target.id, { name: 'Só Nome', version: 1 });

      expect(res.body).toMatchObject({
        name: 'Só Nome',
        role: 'content-brief-editor',
      });
    });

    it('versão desatualizada dá 409 USER_VERSION_OUTDATED', async () => {
      const target = await createUser(e2e);
      await patch(target.id, { name: 'Primeira', version: 1 });

      const res = await patch(target.id, { name: 'Segunda', version: 1 });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('USER_VERSION_OUTDATED');
      expect((await findOne(target.id)).body.name).toBe('Primeira');
    });

    it.each([
      [{ version: 1 }, 'INVALID_REQUEST'],
      [{ name: 'A' }, 'INVALID_REQUEST'],
      [{ name: '   ', version: 1 }, 'INVALID_USER_NAME'],
      [{ role: 'chefe', version: 1 }, 'INVALID_REQUEST'],
      [{ email: 'novo@e2e.test', version: 1 }, 'INVALID_REQUEST'],
    ])('corpo %o dá 400 %s', async (body, code) => {
      const target = await createUser(e2e);

      const res = await patch(target.id, body);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(code);
    });

    it('usuário inexistente dá 404', async () => {
      const res = await patch(MISSING_ID, { name: 'X', version: 1 });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('USER_NOT_FOUND');
    });

    it('não pode mudar o próprio papel (CANNOT_MODIFY_SELF), mas pode mudar o nome', async () => {
      const other = await createUser(e2e, { role: Role.Admin });
      expect(other.id).not.toBe(admin.id);

      const role = await patch(admin.id, {
        role: 'content-brief-viewer',
        version: 1,
      });
      const name = await patch(admin.id, {
        name: 'Admin Renomeado',
        version: 1,
      });

      expect(role.status).toBe(409);
      expect(role.body.code).toBe('CANNOT_MODIFY_SELF');
      expect(name.status).toBe(200);
      expect(name.body.name).toBe('Admin Renomeado');
    });

    it('não rebaixa o último administrador ativo (LAST_ADMIN)', async () => {
      // O ator é o admin avulso do token (sem linha em `users`): o admin real é o único.
      const res = await patch(
        admin.id,
        { role: 'content-brief-editor', version: 1 },
        TOKENS.admin,
      );

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('LAST_ADMIN');
      expect((await findOne(admin.id)).body.role).toBe('admin');
    });

    it('rebaixa um admin quando existe outro ativo', async () => {
      const other = await createUser(e2e, { role: Role.Admin });

      const res = await patch(other.id, {
        role: 'content-brief-viewer',
        version: 1,
      });

      expect(res.status).toBe(200);
    });
  });

  describe('POST /users/:id/deactivate', () => {
    it('desativa, nega login e refresh e revoga as sessões, mas o access token vale até expirar', async () => {
      const target = await createUser(e2e);
      const session = await loginAs(e2e, target);

      const res = await action(target.id, 'deactivate');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: 'DEACTIVATED', version: 2 });
      const relogin = await login(e2e, target);
      expect(relogin.status).toBe(403);
      expect(relogin.body.code).toBe('USER_DEACTIVATED');
      const renewed = await refresh(e2e, session.refreshToken);
      expect(renewed.status).toBe(401);
      expect(renewed.body.code).toBe('INVALID_REFRESH_TOKEN');
      const active = await e2e.dataSource.query(
        'SELECT 1 FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL',
        [target.id],
      );
      expect(active).toHaveLength(0);
      // Limite documentado (ADR-016): o access token já emitido vale até expirar.
      const stale = await e2e.client.get(USER_INFO_URL, {
        token: session.accessToken,
      });
      expect(stale.status).toBe(200);
    });

    it('é idempotente', async () => {
      const target = await createUser(e2e);

      const first = await action(target.id, 'deactivate');
      const second = await action(target.id, 'deactivate');

      expect(second.status).toBe(200);
      expect(second.body.version).toBe(first.body.version);
    });

    it('não desativa a si mesmo (CANNOT_MODIFY_SELF)', async () => {
      await createUser(e2e, { role: Role.Admin });

      const res = await action(admin.id, 'deactivate');

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('CANNOT_MODIFY_SELF');
      expect((await findOne(admin.id)).body.status).toBe('ACTIVE');
    });

    it('não desativa o último administrador ativo (LAST_ADMIN)', async () => {
      const res = await action(admin.id, 'deactivate', TOKENS.admin);

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('LAST_ADMIN');
    });

    it('desativa um admin se sobra outro; o último que restou fica protegido', async () => {
      const second = await createUser(e2e, { role: Role.Admin });

      const first = await action(second.id, 'deactivate');
      const last = await action(admin.id, 'deactivate', TOKENS.admin);

      expect(first.status).toBe(200);
      expect(last.status).toBe(409);
      expect(last.body.code).toBe('LAST_ADMIN');
    });

    it('admin desativado não conta como "outro admin"', async () => {
      await createUser(e2e, { role: Role.Admin, deactivated: true });

      const res = await action(admin.id, 'deactivate', TOKENS.admin);

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('LAST_ADMIN');
    });

    it('CORRIDA: dois admins se desativando ao mesmo tempo nunca zeram os administradores', async () => {
      const other = await createUser(e2e, { role: Role.Admin });
      const otherToken = (await loginAs(e2e, other)).accessToken;

      const results = await Promise.all([
        action(other.id, 'deactivate', adminToken),
        action(admin.id, 'deactivate', otherToken),
      ]);

      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(results.find((r) => r.status === 409)?.body.code).toBe(
        'LAST_ADMIN',
      );
      const admins = await e2e.dataSource.query(
        `SELECT 1 FROM users WHERE role = 'admin' AND status = 'ACTIVE'`,
      );
      expect(admins).toHaveLength(1);
    });

    it('usuário inexistente dá 404', async () => {
      const res = await action(MISSING_ID, 'deactivate');

      expect(res.status).toBe(404);
    });
  });

  describe('rede de segurança do repositório (último admin)', () => {
    const ACTOR = { id: 'e2e-setup', name: 'Setup E2E' };

    it('recusa gravar um estado sem administrador ativo, mesmo sem passar pelo caso de uso', async () => {
      const repository = e2e.app.get<UserRepositoryInterface>(USER_REPOSITORY);
      const user = await repository.findById(admin.id);
      user?.deactivate(ACTOR, e2e.clock.now());

      await expect(
        repository.save(user as NonNullable<typeof user>, 1),
      ).rejects.toBeInstanceOf(LastAdminError);

      expect((await findOne(admin.id)).body.status).toBe('ACTIVE');
    });

    it('duas gravações simultâneas que tirariam os dois admins: uma delas é recusada', async () => {
      const other = await createUser(e2e, { role: Role.Admin });
      const repository = e2e.app.get<UserRepositoryInterface>(USER_REPOSITORY);
      const [a, b] = await Promise.all([
        repository.findById(admin.id),
        repository.findById(other.id),
      ]);
      a?.deactivate(ACTOR, e2e.clock.now());
      b?.deactivate(ACTOR, e2e.clock.now());

      const results = await Promise.allSettled([
        repository.save(a as NonNullable<typeof a>, 1),
        repository.save(b as NonNullable<typeof b>, 1),
      ]);

      expect(results.map((r) => r.status).sort()).toEqual([
        'fulfilled',
        'rejected',
      ]);
      const rejected = results.find((r) => r.status === 'rejected');
      expect((rejected as PromiseRejectedResult).reason).toBeInstanceOf(
        LastAdminError,
      );
      const admins = await e2e.dataSource.query(
        `SELECT 1 FROM users WHERE role = 'admin' AND status = 'ACTIVE'`,
      );
      expect(admins).toHaveLength(1);
    });
  });

  describe('POST /users/:id/reactivate', () => {
    it('reativa, destrava e permite entrar de novo', async () => {
      const target = await createUser(e2e, { deactivated: true });
      await e2e.dataSource.query(
        `UPDATE users SET locked_until = now() + interval '1 day' WHERE id = $1`,
        [target.id],
      );

      const res = await action(target.id, 'reactivate');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ACTIVE');
      expect(res.body.lockedUntil).toBeNull();
      expect((await login(e2e, target)).status).toBe(200);
    });

    it('é idempotente e 404 para inexistente', async () => {
      const target = await createUser(e2e);

      const again = await action(target.id, 'reactivate');
      const missing = await action(MISSING_ID, 'reactivate');

      expect(again.status).toBe(200);
      expect(again.body.version).toBe(1);
      expect(missing.status).toBe(404);
    });
  });

  describe('POST /users/:id/reset-password', () => {
    it('gera senha provisória única vez, invalida a antiga, exige troca e revoga as sessões', async () => {
      const target = await createUser(e2e, { mustChangePassword: false });
      const session = await loginAs(e2e, target);

      const res = await action(target.id, 'reset-password');

      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(res.body.temporaryPassword).toMatch(/^.{16}$/);
      expect(res.body.user.mustChangePassword).toBe(true);
      expect((await login(e2e, target)).status).toBe(401);
      const relogin = await login(e2e, {
        email: target.email,
        password: res.body.temporaryPassword ?? '',
      });
      expect(relogin.status).toBe(200);
      expect(relogin.body.mustChangePassword).toBe(true);
      expect((await refresh(e2e, session.refreshToken)).status).toBe(401);
    });

    it('destrava uma conta bloqueada', async () => {
      const target = await createUser(e2e);
      for (let i = 0; i < 5; i++) {
        await login(e2e, { email: target.email, password: 'errada-0000000' });
      }
      expect((await login(e2e, target)).body.code).toBe('ACCOUNT_LOCKED');

      const res = await action(target.id, 'reset-password');

      const relogin = await login(e2e, {
        email: target.email,
        password: res.body.temporaryPassword ?? '',
      });
      expect(relogin.status).toBe(200);
    });

    it('cada redefinição gera uma senha diferente e guarda só o hash', async () => {
      const target = await createUser(e2e);

      const a = await action(target.id, 'reset-password');
      const b = await action(target.id, 'reset-password');

      expect(a.body.temporaryPassword).not.toBe(b.body.temporaryPassword);
      const [row] = await e2e.dataSource.query(
        'SELECT password_hash FROM users WHERE id = $1',
        [target.id],
      );
      expect(row.password_hash).toMatch(/^\$argon2id\$/);
    });

    it('usuário inexistente dá 404 e a senha não é gerada', async () => {
      const res = await action(MISSING_ID, 'reset-password');

      expect(res.status).toBe(404);
      expect(res.body).not.toHaveProperty('temporaryPassword');
    });
  });

  describe('permissão user:read / user:write', () => {
    it.each([
      ['editor', () => TOKENS.editor],
      ['viewer', () => TOKENS.viewer],
    ])('%s recebe 403 em todas as rotas de /users', async (_role, token) => {
      const target = await createUser(e2e);
      const responses = await Promise.all([
        list('', token()),
        findOne(target.id, token()),
        create({ name: 'X', email: 'x@e2e.test', role: 'admin' }, token()),
        patch(target.id, { name: 'X', version: 1 }, token()),
        action(target.id, 'deactivate', token()),
        action(target.id, 'reactivate', token()),
        action(target.id, 'reset-password', token()),
      ]);

      for (const res of responses) {
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('FORBIDDEN');
      }
      expect((await findOne(target.id)).body).toMatchObject({
        status: 'ACTIVE',
        version: 1,
      });
      const created = await e2e.dataSource.query(
        `SELECT 1 FROM users WHERE email = 'x@e2e.test'`,
      );
      expect(created).toHaveLength(0);
    });

    it('sem token dá 401', async () => {
      const res = await e2e.client.get<ErrorBody>(URL);

      expect(res.status).toBe(401);
    });
  });

  it('as respostas nunca vazam hash nem token de outro usuário', async () => {
    const target = await createUser(e2e);
    await loginAs(e2e, target);

    const bodies = await Promise.all([
      list(),
      findOne(target.id),
      patch(target.id, { name: 'Outro', version: 1 }),
      action(target.id, 'deactivate'),
      action(target.id, 'reactivate'),
    ]);

    for (const res of bodies) {
      const text = JSON.stringify(res.body);
      expect(text).not.toMatch(
        /argon2|password_hash|passwordHash|refresh|token_hash/i,
      );
    }
  });
});
