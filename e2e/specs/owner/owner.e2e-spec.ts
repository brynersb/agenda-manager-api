import { cleanDatabase } from '../../src/core/database';
import { TOKENS } from '../../src/core/tokens';
import { type AppE2e, bootstrapApp } from '../../src/runner/app-bootstrap';

type Registry = {
  id: string;
  name: string;
  email: string | null;
  active: boolean;
  version: number;
  openContentBriefs: number;
};

type ErrorBody = {
  statusCode: number;
  code: string;
  message: string;
  fields?: { field: string; message: string }[];
};

const URL = '/api/v1/owners';
const MISSING_ID = '0192f6a0-7c1e-7a3b-9d52-4f1e8b6c2a10';
const UUID_V7 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('Responsáveis (e2e)', () => {
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

  const create = (name: string, token: string = TOKENS.editor) =>
    e2e.client.post<Registry & ErrorBody>(URL, { token, body: { name } });

  const findAll = (query = '', token: string = TOKENS.editor) =>
    e2e.client.get<Registry[]>(`${URL}${query}`, { token });

  describe('autenticação e permissões', () => {
    it('sem token responde 401 em todas as rotas', async () => {
      const routes = [
        e2e.client.get<ErrorBody>(URL),
        e2e.client.post<ErrorBody>(URL, { body: { name: 'X' } }),
        e2e.client.patch<ErrorBody>(`${URL}/${MISSING_ID}`, {
          body: { name: 'X', version: 1 },
        }),
        e2e.client.post<ErrorBody>(`${URL}/${MISSING_ID}/archive`),
        e2e.client.post<ErrorBody>(`${URL}/${MISSING_ID}/reactivate`),
      ];

      for (const res of await Promise.all(routes)) {
        expect(res.status).toBe(401);
        expect(res.body.code).toBe('UNAUTHENTICATED');
      }
    });

    it('leitor lista, mas recebe 403 FORBIDDEN nas escritas', async () => {
      const created = await create('Bela Vista');

      const list = await findAll('', TOKENS.viewer);
      expect(list.status).toBe(200);
      expect(list.body).toHaveLength(1);

      const writes = await Promise.all([
        e2e.client.post<ErrorBody>(URL, {
          token: TOKENS.viewer,
          body: { name: 'Other' },
        }),
        e2e.client.patch<ErrorBody>(`${URL}/${created.body.id}`, {
          token: TOKENS.viewer,
          body: { name: 'Other', version: 1 },
        }),
        e2e.client.post<ErrorBody>(`${URL}/${created.body.id}/archive`, {
          token: TOKENS.viewer,
        }),
        e2e.client.post<ErrorBody>(`${URL}/${created.body.id}/reactivate`, {
          token: TOKENS.viewer,
        }),
      ]);
      for (const res of writes) {
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('FORBIDDEN');
      }
      expect((await findAll()).body).toHaveLength(1);
    });

    it('token com papel desconhecido recebe 401 até na leitura', async () => {
      const res = await findAll('', TOKENS.unknownRole);

      expect(res.status).toBe(401);
      expect((res.body as unknown as ErrorBody).code).toBe('UNAUTHENTICATED');
    });
  });

  describe('criar e listar', () => {
    it('cria e devolve o contrato do CadastroResponse', async () => {
      const res = await create('Residencial Ipê');

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        id: expect.stringMatching(UUID_V7),
        name: 'Residencial Ipê',
        email: null,
        active: true,
        version: 1,
        openContentBriefs: 0,
      });
    });

    it('lista ordenada por nome em pt-BR ("Água Clara" antes de "Bela Vista")', async () => {
      await create('Vila Nova');
      await create('Bela Vista');
      await create('Água Clara');
      await create('Cedro');

      const res = await findAll();

      expect(res.status).toBe(200);
      expect(res.body.map((c) => c.name)).toEqual([
        'Água Clara',
        'Bela Vista',
        'Cedro',
        'Vila Nova',
      ]);
    });

    it('lista vazia é 200 com array vazio', async () => {
      const res = await findAll();

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('remove espaços nas pontas e colapsa os internos', async () => {
      const res = await create('  Bela    Vista  ');

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Bela Vista');
    });

    it('grava a auditoria do ator e o nome normalizado calculado pelo domínio', async () => {
      const res = await create('Residencial Ipê');

      const [row] = await e2e.dataSource.query(
        'SELECT normalized_name, created_by, created_by_name, updated_by FROM owners WHERE id = $1',
        [res.body.id],
      );
      expect(row).toEqual({
        normalized_name: 'residencial ipe',
        created_by: 'e2e-editor',
        created_by_name: 'Editor E2E',
        updated_by: 'e2e-editor',
      });
    });

    it('nome duplicado ignorando caixa e acento responde 409', async () => {
      await create('Residencial Ipê');

      const res = await create('residencial ipe');

      expect(res.status).toBe(409);
      expect(res.body).toEqual({
        statusCode: 409,
        code: 'OWNER_NAME_DUPLICATED',
        message: 'Já existe um responsável com este nome.',
      });
      expect(await findAll()).toMatchObject({
        body: [{ name: 'Residencial Ipê' }],
      });
    });

    it('homônimo arquivado: 409 com a mensagem que orienta a reativar', async () => {
      const original = await create('Bela Vista');
      await e2e.client.post(`${URL}/${original.body.id}/archive`, {
        token: TOKENS.editor,
      });

      const res = await create('BELA VISTA');

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({
        code: 'OWNER_NAME_DUPLICATED',
        message:
          'Já existe um responsável arquivado com este nome. Reative-o em vez de criar outro.',
      });
    });

    it('dois pedidos simultâneos com o mesmo nome: um 201 e um 409', async () => {
      const [a, b] = await Promise.all([
        create('Corrida Alpha'),
        create('corrida alpha'),
      ]);

      expect([a.status, b.status].sort()).toEqual([201, 409]);
      const loser = a.status === 409 ? a : b;
      expect(loser.body.code).toBe('OWNER_NAME_DUPLICATED');
      expect((await findAll()).body).toHaveLength(1);
    });

    it.each([
      ['empty', ''],
      ['só espaços', '    '],
      ['81 caracteres', 'a'.repeat(81)],
    ])('nome %s responde 400 INVALID_REGISTRY_NAME', async (_d, name) => {
      const res = await create(name);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_REGISTRY_NAME');
    });

    it('aceita nome de 80 caracteres', async () => {
      expect((await create('a'.repeat(80))).status).toBe(201);
    });

    it('corpo fora do contrato responde 400 INVALID_REQUEST com fields', async () => {
      const withoutName = await e2e.client.post<ErrorBody>(URL, {
        token: TOKENS.editor,
        body: {},
      });
      const extra = await e2e.client.post<ErrorBody>(URL, {
        token: TOKENS.editor,
        body: { name: 'X', active: false },
      });
      const wrongType = await e2e.client.post<ErrorBody>(URL, {
        token: TOKENS.editor,
        body: { name: 123 },
      });

      for (const res of [withoutName, extra, wrongType]) {
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INVALID_REQUEST');
        expect(res.body.fields?.length).toBeGreaterThan(0);
      }
      expect(extra.body.fields).toEqual([
        { field: 'active', message: 'active não é um campo permitido' },
      ]);
    });
  });

  describe('arquivar e reativar', () => {
    it('arquivar tira da lista padrão e mantém em includeArchived=true', async () => {
      const bela = await create('Bela Vista');
      await create('Água Clara');

      const archived = await e2e.client.post<Registry>(
        `${URL}/${bela.body.id}/archive`,
        { token: TOKENS.editor },
      );

      expect(archived.status).toBe(200);
      expect(archived.body).toMatchObject({
        id: bela.body.id,
        active: false,
        version: 2,
      });
      expect((await findAll()).body.map((c) => c.name)).toEqual(['Água Clara']);
      expect((await findAll('?includeArchived=false')).body).toHaveLength(1);
      const all = await findAll('?includeArchived=true');
      expect(all.body.map((c) => [c.name, c.active])).toEqual([
        ['Água Clara', true],
        ['Bela Vista', false],
      ]);
    });

    it('arquivar é idempotente: repetir devolve 200 sem mudar a versão', async () => {
      const bela = await create('Bela Vista');
      await e2e.client.post(`${URL}/${bela.body.id}/archive`, {
        token: TOKENS.editor,
      });

      const repeated = await e2e.client.post<Registry>(
        `${URL}/${bela.body.id}/archive`,
        { token: TOKENS.editor },
      );

      expect(repeated.status).toBe(200);
      expect(repeated.body).toMatchObject({ active: false, version: 2 });
    });

    it('reativar devolve à lista padrão e é idempotente', async () => {
      const bela = await create('Bela Vista');
      await e2e.client.post(`${URL}/${bela.body.id}/archive`, {
        token: TOKENS.editor,
      });

      const reactivated = await e2e.client.post<Registry>(
        `${URL}/${bela.body.id}/reactivate`,
        { token: TOKENS.editor },
      );
      const repeated = await e2e.client.post<Registry>(
        `${URL}/${bela.body.id}/reactivate`,
        { token: TOKENS.editor },
      );

      expect(reactivated.status).toBe(200);
      expect(reactivated.body).toMatchObject({ active: true, version: 3 });
      expect(repeated.status).toBe(200);
      expect(repeated.body).toMatchObject({ active: true, version: 3 });
      expect((await findAll()).body).toHaveLength(1);
    });

    it('arquivar e reativar um id inexistente responde 404', async () => {
      for (const action of ['archive', 'reactivate']) {
        const res = await e2e.client.post<ErrorBody>(
          `${URL}/${MISSING_ID}/${action}`,
          { token: TOKENS.editor },
        );

        expect(res.status).toBe(404);
        expect(res.body).toEqual({
          statusCode: 404,
          code: 'OWNER_NOT_FOUND',
          message: 'Responsável não encontrado',
        });
      }
    });

    it('id que não é UUID responde 400 INVALID_REQUEST', async () => {
      const res = await e2e.client.post<ErrorBody>(`${URL}/abc/archive`, {
        token: TOKENS.editor,
      });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_REQUEST');
    });

    it('registra quem arquivou na auditoria', async () => {
      const bela = await create('Bela Vista');

      await e2e.client.post(`${URL}/${bela.body.id}/archive`, {
        token: TOKENS.editor,
      });

      const [row] = await e2e.dataSource.query(
        'SELECT active, updated_by, version FROM owners WHERE id = $1',
        [bela.body.id],
      );
      expect(row).toEqual({
        active: false,
        updated_by: 'e2e-editor',
        version: 2,
      });
    });
  });

  describe('rename', () => {
    it('renomeia e incrementa a versão', async () => {
      const bela = await create('Bela Vista');

      const res = await e2e.client.patch<Registry>(`${URL}/${bela.body.id}`, {
        token: TOKENS.editor,
        body: { name: '  Vila   Nova ', version: 1 },
      });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        id: bela.body.id,
        name: 'Vila Nova',
        email: null,
        active: true,
        version: 2,
        openContentBriefs: 0,
      });
      expect((await findAll()).body.map((c) => c.name)).toEqual(['Vila Nova']);
    });

    it('versão velha responde 409 OWNER_VERSION_OUTDATED', async () => {
      const bela = await create('Bela Vista');
      await e2e.client.patch(`${URL}/${bela.body.id}`, {
        token: TOKENS.editor,
        body: { name: 'Vila Nova', version: 1 },
      });

      const res = await e2e.client.patch<ErrorBody>(`${URL}/${bela.body.id}`, {
        token: TOKENS.editor,
        body: { name: 'Outro Nome', version: 1 },
      });

      expect(res.status).toBe(409);
      expect(res.body).toEqual({
        statusCode: 409,
        code: 'OWNER_VERSION_OUTDATED',
        message:
          'Este responsável foi alterado por outra pessoa. Recarregue para ver a versão atual.',
      });
      expect((await findAll()).body[0].name).toBe('Vila Nova');
    });

    it('nome de outro responsável (inclusive arquivado) responde 409', async () => {
      const bela = await create('Bela Vista');
      const vila = await create('Vila Nova');

      const active = await e2e.client.patch<ErrorBody>(
        `${URL}/${bela.body.id}`,
        {
          token: TOKENS.editor,
          body: { name: 'vila nova', version: 1 },
        },
      );
      await e2e.client.post(`${URL}/${vila.body.id}/archive`, {
        token: TOKENS.editor,
      });
      const archived = await e2e.client.patch<ErrorBody>(
        `${URL}/${bela.body.id}`,
        {
          token: TOKENS.editor,
          body: { name: 'Vila Nova', version: 1 },
        },
      );

      expect(active.status).toBe(409);
      expect(active.body.code).toBe('OWNER_NAME_DUPLICATED');
      expect(archived.status).toBe(409);
      expect(archived.body.message).toContain('arquivado');
    });

    it('mudar só caixa e acento do próprio nome é permitido', async () => {
      const ipe = await create('residencial ipe');

      const res = await e2e.client.patch<Registry>(`${URL}/${ipe.body.id}`, {
        token: TOKENS.editor,
        body: { name: 'Residencial Ipê', version: 1 },
      });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Residencial Ipê');
    });

    it('id inexistente responde 404; nome inválido, 400', async () => {
      const notFound = await e2e.client.patch<ErrorBody>(
        `${URL}/${MISSING_ID}`,
        {
          token: TOKENS.editor,
          body: { name: 'X', version: 1 },
        },
      );
      const bela = await create('Bela Vista');
      const invalid = await e2e.client.patch<ErrorBody>(
        `${URL}/${bela.body.id}`,
        {
          token: TOKENS.editor,
          body: { name: '', version: 1 },
        },
      );

      expect(notFound.status).toBe(404);
      expect(notFound.body.code).toBe('OWNER_NOT_FOUND');
      expect(invalid.status).toBe(400);
      expect(invalid.body.code).toBe('INVALID_REGISTRY_NAME');
    });

    it('corpo sem version ou com version inválida responde 400', async () => {
      const bela = await create('Bela Vista');

      for (const body of [
        { name: 'X' },
        { name: 'X', version: 0 },
        { name: 'X', version: '1' },
      ]) {
        const res = await e2e.client.patch<ErrorBody>(
          `${URL}/${bela.body.id}`,
          {
            token: TOKENS.editor,
            body,
          },
        );

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INVALID_REQUEST');
      }
    });
  });

  describe('e-mail', () => {
    const post = (body: unknown) =>
      e2e.client.post<Registry & ErrorBody>(URL, {
        token: TOKENS.editor,
        body,
      });
    const patch = (id: string, body: unknown) =>
      e2e.client.patch<Registry & ErrorBody>(`${URL}/${id}`, {
        token: TOKENS.editor,
        body,
      });

    it('cria com e-mail, que aparece na resposta e na lista', async () => {
      const res = await post({ name: 'Ana Souza', email: ' ana@bora.com.br ' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        name: 'Ana Souza',
        email: 'ana@bora.com.br',
      });
      expect((await findAll()).body[0].email).toBe('ana@bora.com.br');
    });

    it('e-mail ausente, nulo ou em branco fica null', async () => {
      for (const body of [
        { name: 'A' },
        { name: 'B', email: null },
        { name: 'C', email: '   ' },
      ]) {
        const res = await post(body);

        expect(res.status).toBe(201);
        expect(res.body.email).toBeNull();
      }
    });

    it('e-mail inválido responde 400 INVALID_EMAIL e não grava', async () => {
      const res = await post({ name: 'Ana', email: 'sem-arroba' });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        statusCode: 400,
        code: 'INVALID_EMAIL',
      });
      expect((await findAll()).body).toEqual([]);
    });

    it('e-mail que não é texto responde 400 INVALID_REQUEST', async () => {
      const res = await post({ name: 'Ana', email: 42 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_REQUEST');
    });

    it('PATCH sem email mantém; com string troca; com null remove', async () => {
      const ana = await post({ name: 'Ana', email: 'ana@bora.com.br' });

      const kept = await patch(ana.body.id, {
        name: 'Ana Lima',
        version: 1,
      });
      const swapped = await patch(ana.body.id, {
        name: 'Ana Lima',
        email: 'lima@bora.com.br',
        version: 2,
      });
      const removed = await patch(ana.body.id, {
        name: 'Ana Lima',
        email: null,
        version: 3,
      });

      expect(kept.body).toMatchObject({
        email: 'ana@bora.com.br',
        version: 2,
      });
      expect(swapped.body).toMatchObject({
        email: 'lima@bora.com.br',
        version: 3,
      });
      expect(removed.body).toMatchObject({ email: null, version: 4 });
    });

    it('PATCH com e-mail inválido responde 400 e não altera nada', async () => {
      const ana = await post({ name: 'Ana', email: 'ana@bora.com.br' });

      const res = await patch(ana.body.id, {
        name: 'Ana Lima',
        email: 'invalid',
        version: 1,
      });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_EMAIL');
      expect((await findAll()).body[0]).toMatchObject({
        name: 'Ana',
        email: 'ana@bora.com.br',
        version: 1,
      });
    });

    it('arquivar e reativar preservam o e-mail', async () => {
      const ana = await post({ name: 'Ana', email: 'ana@bora.com.br' });

      const archived = await e2e.client.post<Registry>(
        `${URL}/${ana.body.id}/archive`,
        { token: TOKENS.editor },
      );

      expect(archived.body.email).toBe('ana@bora.com.br');
    });

    it('user_id fica nulo (vínculo com usuário sem uso no MVP)', async () => {
      const ana = await post({ name: 'Ana' });

      const [row] = await e2e.dataSource.query(
        'SELECT user_id FROM owners WHERE id = $1',
        [ana.body.id],
      );
      expect(row.user_id).toBeNull();
    });
  });

  describe('query de listagem', () => {
    it('includeArchived inválido responde 400', async () => {
      const res = await e2e.client.get<ErrorBody>(
        `${URL}?includeArchived=talvez`,
        {
          token: TOKENS.editor,
        },
      );

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_REQUEST');
      expect(res.body.fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'includeArchived' }),
        ]),
      );
    });
  });
});
