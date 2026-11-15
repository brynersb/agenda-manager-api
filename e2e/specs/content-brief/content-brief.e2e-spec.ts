import { cleanDatabase } from '../../src/core/database';
import { TOKENS } from '../../src/core/tokens';
import { type AppE2e, bootstrapApp } from '../../src/runner/app-bootstrap';

type RegistrySummary = { id: string; name: string; active: boolean };

type ContentBrief = {
  id: string;
  title: string;
  description: string;
  dueDate: string | null;
  dueStatus: string;
  daysUntilDue: number | null;
  status: string;
  action: string | null;
  channel: string | null;
  estateDevelopment: RegistrySummary | null;
  owner: RegistrySummary | null;
  completedAt: string | null;
  version: number;
  createdAt: string;
  createdBy: { id: string; name: string | null };
  updatedAt: string;
  updatedBy: { id: string; name: string | null };
};

type Registry = {
  id: string;
  name: string;
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

const URL = '/api/v1/content-briefs';
const ESTATE_DEVELOPMENTS_URL = '/api/v1/estate-developments';
const OWNERS_URL = '/api/v1/owners';
const MISSING_ID = '0192f6a0-7c1e-7a3b-9d52-4f1e8b6c2a10';
const UUID_V7 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const NOW_ISO = '2026-11-14T12:00:00.000Z';

describe('Pautas (e2e)', () => {
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

  const create = (body: unknown, token: string = TOKENS.editor) =>
    e2e.client.post<ContentBrief & ErrorBody>(URL, { token, body });

  const find = (id: string, token: string = TOKENS.editor) =>
    e2e.client.get<ContentBrief & ErrorBody>(`${URL}/${id}`, { token });

  const put = (id: string, body: unknown, token: string = TOKENS.editor) =>
    e2e.client.put<ContentBrief & ErrorBody>(`${URL}/${id}`, { token, body });

  const patchStatus = (
    id: string,
    body: unknown,
    token: string = TOKENS.editor,
  ) =>
    e2e.client.patch<ContentBrief & ErrorBody>(`${URL}/${id}/status`, {
      token,
      body,
    });

  const remove = (id: string, token: string = TOKENS.editor) =>
    e2e.client.delete<ErrorBody | string>(`${URL}/${id}`, { token });

  const createEstateDevelopment = async (name: string) => {
    const res = await e2e.client.post<Registry>(ESTATE_DEVELOPMENTS_URL, {
      token: TOKENS.editor,
      body: { name },
    });
    return res.body;
  };

  const createOwner = async (name: string) => {
    const res = await e2e.client.post<Registry>(OWNERS_URL, {
      token: TOKENS.editor,
      body: { name },
    });
    return res.body;
  };

  const archive = (url: string, id: string) =>
    e2e.client.post<Registry>(`${url}/${id}/archive`, {
      token: TOKENS.editor,
    });

  const findRegistry = async (url: string, id: string) => {
    const res = await e2e.client.get<Registry[]>(
      `${url}?includeArchived=true`,
      {
        token: TOKENS.editor,
      },
    );
    const registry = res.body.find((item) => item.id === id);
    if (!registry) {
      throw new Error(`Cadastro ${id} não encontrado na lista`);
    }
    return registry;
  };

  /** Corpo completo de PUT a partir de uma pauta lida (como o front faz). */
  const bodyFrom = (brief: ContentBrief, overrides: object = {}) => ({
    title: brief.title,
    description: brief.description,
    dueDate: brief.dueDate,
    status: brief.status,
    action: brief.action,
    channel: brief.channel,
    estateDevelopmentId: brief.estateDevelopment?.id ?? null,
    ownerId: brief.owner?.id ?? null,
    version: brief.version,
    ...overrides,
  });

  describe('autenticação e permissões', () => {
    it('sem token responde 401 em todas as rotas', async () => {
      const routes = [
        e2e.client.post<ErrorBody>(URL, { body: { title: 'X' } }),
        e2e.client.get<ErrorBody>(`${URL}/${MISSING_ID}`),
        e2e.client.put<ErrorBody>(`${URL}/${MISSING_ID}`, {
          body: { title: 'X', version: 1 },
        }),
        e2e.client.patch<ErrorBody>(`${URL}/${MISSING_ID}/status`, {
          body: { status: 'DONE', version: 1 },
        }),
        e2e.client.delete<ErrorBody>(`${URL}/${MISSING_ID}`),
      ];

      for (const res of await Promise.all(routes)) {
        expect(res.status).toBe(401);
        expect(res.body.code).toBe('UNAUTHENTICATED');
      }
    });

    it('leitor lê por id (200), mas recebe 403 FORBIDDEN em todas as escritas', async () => {
      const created = await create({ title: 'Post' });
      const id = created.body.id;

      const read = await find(id, TOKENS.viewer);
      expect(read.status).toBe(200);
      expect(read.body.title).toBe('Post');

      const writes = await Promise.all([
        create({ title: 'Outro' }, TOKENS.viewer),
        put(id, { title: 'Outro', version: 1 }, TOKENS.viewer),
        patchStatus(id, { status: 'DONE', version: 1 }, TOKENS.viewer),
        remove(id, TOKENS.viewer),
      ]);
      for (const res of writes) {
        expect(res.status).toBe(403);
        expect((res.body as ErrorBody).code).toBe('FORBIDDEN');
      }

      const after = await find(id);
      expect(after.body).toMatchObject({
        title: 'Post',
        status: 'TODO',
        version: 1,
      });
    });

    it('usuário sem papel recebe 403 até na leitura', async () => {
      const created = await create({ title: 'Post' });

      const res = await find(created.body.id, TOKENS.noRole);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });
  });

  describe('criar', () => {
    it('cria só com o título e devolve o contrato completo com os padrões', async () => {
      const res = await create({ title: 'Post de lançamento' });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        id: expect.stringMatching(UUID_V7),
        title: 'Post de lançamento',
        description: '',
        dueDate: null,
        dueStatus: 'no-due-date',
        daysUntilDue: null,
        status: 'TODO',
        action: null,
        channel: null,
        estateDevelopment: null,
        owner: null,
        completedAt: null,
        version: 1,
        createdAt: NOW_ISO,
        createdBy: { id: 'e2e-editor', name: 'Editor E2E' },
        updatedAt: NOW_ISO,
        updatedBy: { id: 'e2e-editor', name: 'Editor E2E' },
      });
    });

    it('cria com todos os campos e os cadastros atribuídos', async () => {
      const estate = await createEstateDevelopment('Residencial Ipê');
      const owner = await createOwner('Ana Souza');

      const res = await create({
        title: '  Post de lançamento  ',
        description: ' Arte aprovada pela diretoria ',
        dueDate: '2026-11-20',
        status: 'IN_PROGRESS',
        action: 'CREATE',
        channel: 'INSTAGRAM',
        estateDevelopmentId: estate.id,
        ownerId: owner.id,
      });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        title: 'Post de lançamento',
        description: 'Arte aprovada pela diretoria',
        dueDate: '2026-11-20',
        dueStatus: 'next-7-days',
        daysUntilDue: 6,
        status: 'IN_PROGRESS',
        action: 'CREATE',
        channel: 'INSTAGRAM',
        estateDevelopment: {
          id: estate.id,
          name: 'Residencial Ipê',
          active: true,
        },
        owner: { id: owner.id, name: 'Ana Souza', active: true },
        completedAt: null,
      });
    });

    it('null explícito vale o mesmo que ausente', async () => {
      const res = await create({
        title: 'Post',
        description: null,
        dueDate: null,
        action: null,
        channel: null,
        estateDevelopmentId: null,
        ownerId: null,
      });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        description: '',
        dueDate: null,
        action: null,
        channel: null,
        estateDevelopment: null,
        owner: null,
      });
    });

    it('criar já em DONE grava completedAt', async () => {
      const res = await create({ title: 'Post', status: 'DONE' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        status: 'DONE',
        completedAt: NOW_ISO,
        dueStatus: 'completed',
      });
    });

    it('grava a auditoria do token e os valores no banco (snake_case, enums em inglês)', async () => {
      const res = await create({
        title: 'Post',
        dueDate: '2026-11-14',
        action: 'FOLLOW_UP',
        channel: 'WEBSITE',
      });

      const [row] = await e2e.dataSource.query(
        `SELECT title, due_date::text AS due_date, status::text AS status,
                action::text AS action, channel::text AS channel, version,
                created_by, created_by_name, updated_by, updated_by_name,
                deleted_at, deleted_by, completed_at
           FROM content_briefs WHERE id = $1`,
        [res.body.id],
      );
      expect(row).toEqual({
        title: 'Post',
        due_date: '2026-11-14',
        status: 'TODO',
        action: 'FOLLOW_UP',
        channel: 'WEBSITE',
        version: 1,
        created_by: 'e2e-editor',
        created_by_name: 'Editor E2E',
        updated_by: 'e2e-editor',
        updated_by_name: 'Editor E2E',
        deleted_at: null,
        deleted_by: null,
        completed_at: null,
      });
    });
  });

  describe('prazo (date sem deslocar o dia)', () => {
    it('2026-11-14 volta como "2026-11-14" na criação, na leitura e depois de um PUT', async () => {
      const created = await create({ title: 'Post', dueDate: '2026-11-14' });
      expect(created.body.dueDate).toBe('2026-11-14');

      const read = await find(created.body.id);
      expect(read.body).toMatchObject({
        dueDate: '2026-11-14',
        dueStatus: 'today',
        daysUntilDue: 0,
      });

      // O PUT passa pelo repositório de escrita (entity do TypeORM).
      const updated = await put(
        created.body.id,
        bodyFrom(read.body, { title: 'Post editado' }),
      );
      expect(updated.body.dueDate).toBe('2026-11-14');

      const [row] = await e2e.dataSource.query(
        'SELECT due_date::text AS due_date FROM content_briefs WHERE id = $1',
        [created.body.id],
      );
      expect(row.due_date).toBe('2026-11-14');
    });

    it.each([
      ['ontem (-1)', '2026-11-13', 'overdue', -1],
      ['hoje (0)', '2026-11-14', 'today', 0],
      ['hoje +1', '2026-11-15', 'next-7-days', 1],
      ['hoje +7', '2026-11-21', 'next-7-days', 7],
      ['hoje +8', '2026-11-22', 'later', 8],
    ])(
      'prazo %s: dueStatus e daysUntilDue',
      async (_label, dueDate, dueStatus, days) => {
        const created = await create({ title: 'Post', dueDate });

        const res = await find(created.body.id);

        expect(res.body).toMatchObject({
          dueDate,
          dueStatus,
          daysUntilDue: days,
        });
      },
    );

    it('a situação acompanha o relógio: a mesma pauta vira atrasada no dia seguinte', async () => {
      const created = await create({ title: 'Post', dueDate: '2026-11-14' });
      e2e.clock.setToday('2026-11-15');

      const res = await find(created.body.id);

      expect(res.body).toMatchObject({
        dueStatus: 'overdue',
        daysUntilDue: -1,
      });
    });

    it('concluída com prazo vencido: completed, mantendo daysUntilDue', async () => {
      const created = await create({
        title: 'Post',
        dueDate: '2026-11-01',
        status: 'DONE',
      });

      expect(created.body).toMatchObject({
        dueStatus: 'completed',
        daysUntilDue: -13,
      });
    });
  });

  describe('validações (400)', () => {
    it.each([
      ['título ausente', {}],
      ['título que não é texto', { title: 123 }],
      ['campo fora do contrato', { title: 'X', active: true }],
      ['prazo fora do formato', { title: 'X', dueDate: '14/11/2026' }],
      ['status fora do enum', { title: 'X', status: 'CONCLUIDA' }],
      ['ação fora do enum', { title: 'X', action: 'COBRAR' }],
      ['canal fora do enum', { title: 'X', channel: 'SITE' }],
      [
        'empreendimento que não é UUID',
        { title: 'X', estateDevelopmentId: 'a' },
      ],
      ['responsável que não é UUID', { title: 'X', ownerId: '123' }],
      ['descrição que não é texto', { title: 'X', description: 5 }],
    ])('%s responde 400 INVALID_REQUEST com fields', async (_label, body) => {
      const res = await create(body);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_REQUEST');
      expect(res.body.fields?.length).toBeGreaterThan(0);
      expect(res.body.fields?.[0]).toEqual({
        field: expect.any(String),
        message: expect.any(String),
      });
    });

    it('nomeia o campo e traduz a mensagem', async () => {
      const res = await create({ title: 'X', dueDate: '14/11/2026' });

      expect(res.body.fields).toEqual([
        { field: 'dueDate', message: 'Informe o prazo no formato AAAA-MM-DD' },
      ]);
    });

    it.each([
      ['vazio', ''],
      ['só espaços', '     '],
      ['141 caracteres', 'a'.repeat(141)],
    ])('título %s responde 400 INVALID_TITLE', async (_label, title) => {
      const res = await create({ title });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        statusCode: 400,
        code: 'INVALID_TITLE',
        message: 'O título deve ter entre 1 e 140 caracteres',
      });
    });

    it('aceita título de 140 caracteres', async () => {
      expect((await create({ title: 'a'.repeat(140) })).status).toBe(201);
    });

    it('descrição de 1201 caracteres responde 400 INVALID_DESCRIPTION; 1200 passa', async () => {
      const tooLong = await create({
        title: 'X',
        description: 'a'.repeat(1201),
      });
      const limit = await create({ title: 'X', description: 'a'.repeat(1200) });

      expect(tooLong.status).toBe(400);
      expect(tooLong.body.code).toBe('INVALID_DESCRIPTION');
      expect(limit.status).toBe(201);
    });

    it('prazo inexistente (2026-02-30) responde 400 INVALID_REQUEST, não INVALID_DATE', async () => {
      const res = await create({ title: 'X', dueDate: '2026-02-30' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_REQUEST');
      expect(res.body.message).toContain('2026-02-30');
    });

    it('nenhuma pauta é gravada quando a validação falha', async () => {
      await create({ title: '' });
      await create({ title: 'X', dueDate: '2026-02-30' });
      await create({ title: 'X', estateDevelopmentId: MISSING_ID });

      const [{ count }] = await e2e.dataSource.query(
        'SELECT count(*)::int AS count FROM content_briefs',
      );
      expect(count).toBe(0);
    });

    it('id que não é UUID responde 400 INVALID_REQUEST em GET, PUT, PATCH e DELETE', async () => {
      const responses = await Promise.all([
        e2e.client.get<ErrorBody>(`${URL}/abc`, { token: TOKENS.editor }),
        put('abc', { title: 'X', version: 1 }),
        patchStatus('abc', { status: 'DONE', version: 1 }),
        remove('abc'),
      ]);

      for (const res of responses) {
        expect(res.status).toBe(400);
        expect((res.body as ErrorBody).code).toBe('INVALID_REQUEST');
      }
    });
  });

  describe('cadastros atribuídos', () => {
    it('empreendimento inexistente responde 400 ESTATE_DEVELOPMENT_UNAVAILABLE', async () => {
      const res = await create({ title: 'X', estateDevelopmentId: MISSING_ID });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        code: 'ESTATE_DEVELOPMENT_UNAVAILABLE',
        message: 'O empreendimento informado não existe',
      });
    });

    it('responsável inexistente responde 400 OWNER_UNAVAILABLE', async () => {
      const res = await create({ title: 'X', ownerId: MISSING_ID });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('OWNER_UNAVAILABLE');
    });

    it('empreendimento e responsável arquivados não podem ser atribuídos na criação', async () => {
      const estate = await createEstateDevelopment('Bela Vista');
      const owner = await createOwner('Ana');
      await archive(ESTATE_DEVELOPMENTS_URL, estate.id);
      await archive(OWNERS_URL, owner.id);

      const withEstate = await create({
        title: 'X',
        estateDevelopmentId: estate.id,
      });
      const withOwner = await create({ title: 'X', ownerId: owner.id });

      expect(withEstate.status).toBe(400);
      expect(withEstate.body).toMatchObject({
        code: 'ESTATE_DEVELOPMENT_UNAVAILABLE',
        message:
          'O empreendimento está arquivado e não pode ser atribuído a uma pauta',
      });
      expect(withOwner.status).toBe(400);
      expect(withOwner.body.code).toBe('OWNER_UNAVAILABLE');
    });

    it('arquivar depois de atribuído: a pauta continua mostrando o cadastro (active=false) e PUT mantém', async () => {
      const estate = await createEstateDevelopment('Bela Vista');
      const owner = await createOwner('Ana');
      const created = await create({
        title: 'Post',
        estateDevelopmentId: estate.id,
        ownerId: owner.id,
      });
      await archive(ESTATE_DEVELOPMENTS_URL, estate.id);
      await archive(OWNERS_URL, owner.id);

      const read = await find(created.body.id);
      expect(read.body.estateDevelopment).toEqual({
        id: estate.id,
        name: 'Bela Vista',
        active: false,
      });
      expect(read.body.owner).toEqual({
        id: owner.id,
        name: 'Ana',
        active: false,
      });

      const updated = await put(
        created.body.id,
        bodyFrom(read.body, { title: 'Post editado' }),
      );
      expect(updated.status).toBe(200);
      expect(updated.body).toMatchObject({
        title: 'Post editado',
        estateDevelopment: { id: estate.id, active: false },
        owner: { id: owner.id, active: false },
      });
    });

    it('PUT trocando para um cadastro arquivado bloqueia e não altera a pauta', async () => {
      const bela = await createEstateDevelopment('Bela Vista');
      const vila = await createEstateDevelopment('Vila Nova');
      const created = await create({
        title: 'Post',
        estateDevelopmentId: bela.id,
      });
      await archive(ESTATE_DEVELOPMENTS_URL, vila.id);

      const res = await put(
        created.body.id,
        bodyFrom(created.body, { estateDevelopmentId: vila.id }),
      );

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('ESTATE_DEVELOPMENT_UNAVAILABLE');
      expect((await find(created.body.id)).body).toMatchObject({
        version: 1,
        estateDevelopment: { id: bela.id },
      });
    });

    it('PUT trocando para um cadastro ativo funciona; null remove', async () => {
      const bela = await createEstateDevelopment('Bela Vista');
      const vila = await createEstateDevelopment('Vila Nova');
      const owner = await createOwner('Ana');
      const created = await create({
        title: 'Post',
        estateDevelopmentId: bela.id,
        ownerId: owner.id,
      });

      const swapped = await put(
        created.body.id,
        bodyFrom(created.body, { estateDevelopmentId: vila.id }),
      );
      expect(swapped.status).toBe(200);
      expect(swapped.body.estateDevelopment?.id).toBe(vila.id);

      const cleared = await put(
        created.body.id,
        bodyFrom(swapped.body, { estateDevelopmentId: null, ownerId: null }),
      );
      expect(cleared.body).toMatchObject({
        estateDevelopment: null,
        owner: null,
        version: 3,
      });
    });

    it('trocar o status não valida cadastros (mesmo arquivados)', async () => {
      const estate = await createEstateDevelopment('Bela Vista');
      const created = await create({
        title: 'Post',
        estateDevelopmentId: estate.id,
      });
      await archive(ESTATE_DEVELOPMENTS_URL, estate.id);

      const res = await patchStatus(created.body.id, {
        status: 'IN_PROGRESS',
        version: 1,
      });

      expect(res.status).toBe(200);
      expect(res.body.estateDevelopment).toMatchObject({
        id: estate.id,
        active: false,
      });
    });
  });

  describe('editar (PUT)', () => {
    it('é substituição completa: campo ausente limpa; status ausente mantém', async () => {
      const estate = await createEstateDevelopment('Bela Vista');
      const created = await create({
        title: 'Post',
        description: 'Texto',
        dueDate: '2026-11-20',
        status: 'IN_REVIEW',
        action: 'CREATE',
        channel: 'BLOG',
        estateDevelopmentId: estate.id,
      });

      const res = await put(created.body.id, {
        title: 'Só o título',
        version: created.body.version,
      });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: created.body.id,
        title: 'Só o título',
        description: '',
        dueDate: null,
        dueStatus: 'no-due-date',
        status: 'IN_REVIEW',
        action: null,
        channel: null,
        estateDevelopment: null,
        owner: null,
        version: 2,
        createdAt: created.body.createdAt,
        createdBy: created.body.createdBy,
      });
    });

    it('incrementa a versão a cada edição e grava a auditoria de alteração', async () => {
      const created = await create({ title: 'Post' });

      const first = await put(created.body.id, bodyFrom(created.body));
      const second = await put(
        created.body.id,
        bodyFrom(first.body, { title: 'Dois' }),
      );

      expect(first.body.version).toBe(2);
      expect(second.body).toMatchObject({
        version: 3,
        title: 'Dois',
        updatedBy: { id: 'e2e-editor', name: 'Editor E2E' },
      });
      const [row] = await e2e.dataSource.query(
        'SELECT version, updated_by, created_by FROM content_briefs WHERE id = $1',
        [created.body.id],
      );
      expect(row).toEqual({
        version: 3,
        updated_by: 'e2e-editor',
        created_by: 'e2e-editor',
      });
    });

    it('status informado troca o status e gerencia completedAt', async () => {
      const created = await create({ title: 'Post' });

      const done = await put(
        created.body.id,
        bodyFrom(created.body, { status: 'DONE' }),
      );
      expect(done.body).toMatchObject({
        status: 'DONE',
        completedAt: NOW_ISO,
      });

      const reopened = await put(
        created.body.id,
        bodyFrom(done.body, { status: 'TODO' }),
      );
      expect(reopened.body).toMatchObject({
        status: 'TODO',
        completedAt: null,
      });
    });

    it('sem version ou com version inválida responde 400', async () => {
      const created = await create({ title: 'Post' });

      for (const version of [undefined, 0, '1']) {
        const res = await put(created.body.id, { title: 'X', version });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INVALID_REQUEST');
      }
    });

    it('título inválido responde 400 INVALID_TITLE e não altera nada', async () => {
      const created = await create({ title: 'Post' });

      const res = await put(created.body.id, { title: '  ', version: 1 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_TITLE');
      expect((await find(created.body.id)).body).toMatchObject({
        title: 'Post',
        version: 1,
      });
    });

    it('id inexistente responde 404 CONTENT_BRIEF_NOT_FOUND', async () => {
      const res = await put(MISSING_ID, { title: 'X', version: 1 });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        statusCode: 404,
        code: 'CONTENT_BRIEF_NOT_FOUND',
        message: 'Pauta não encontrada',
      });
    });
  });

  describe('concorrência otimista', () => {
    it('dois PUT com a mesma version em sequência: o segundo recebe 409 e nada é sobrescrito', async () => {
      const created = await create({ title: 'Original' });
      const { id, version } = created.body;

      const first = await put(id, { title: 'Primeira edição', version });
      const second = await put(id, { title: 'Segunda edição', version });

      expect(first.status).toBe(200);
      expect(second.status).toBe(409);
      expect(second.body).toEqual({
        statusCode: 409,
        code: 'CONTENT_BRIEF_VERSION_OUTDATED',
        message:
          'Esta pauta foi alterada por outra pessoa. Recarregue para ver a versão atual.',
      });
      expect((await find(id)).body).toMatchObject({
        title: 'Primeira edição',
        version: 2,
      });
    });

    it('dois PUT simultâneos com a mesma version: um 200 e um 409', async () => {
      const created = await create({ title: 'Original' });
      const { id, version } = created.body;

      const results = await Promise.all([
        put(id, { title: 'Alpha', version }),
        put(id, { title: 'Beta', version }),
      ]);

      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      const loser = results.find((r) => r.status === 409);
      expect(loser?.body.code).toBe('CONTENT_BRIEF_VERSION_OUTDATED');
      expect((await find(id)).body.version).toBe(2);
    });

    it('PATCH de status com version velha responde 409 depois de um PUT', async () => {
      const created = await create({ title: 'Original' });
      await put(created.body.id, { title: 'Editada', version: 1 });

      const res = await patchStatus(created.body.id, {
        status: 'DONE',
        version: 1,
      });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('CONTENT_BRIEF_VERSION_OUTDATED');
      expect((await find(created.body.id)).body.status).toBe('TODO');
    });

    it('PUT com version velha depois de um PATCH de status responde 409', async () => {
      const created = await create({ title: 'Original' });
      await patchStatus(created.body.id, { status: 'IN_PROGRESS', version: 1 });

      const res = await put(created.body.id, {
        title: 'Tarde demais',
        version: 1,
      });

      expect(res.status).toBe(409);
      expect((await find(created.body.id)).body.title).toBe('Original');
    });

    it('version à frente da atual também responde 409', async () => {
      const created = await create({ title: 'Original' });

      const res = await put(created.body.id, { title: 'X', version: 9 });

      expect(res.status).toBe(409);
    });
  });

  describe('status (PATCH)', () => {
    it('troca livre entre os quatro status e incrementa a version', async () => {
      const created = await create({ title: 'Post' });
      let current = created.body;

      for (const status of ['IN_REVIEW', 'TODO', 'IN_PROGRESS', 'DONE']) {
        const res = await patchStatus(current.id, {
          status,
          version: current.version,
        });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe(status);
        expect(res.body.version).toBe(current.version + 1);
        current = res.body;
      }
      expect(current.version).toBe(5);
    });

    it('entrar em DONE grava completedAt; sair limpa', async () => {
      const created = await create({ title: 'Post', dueDate: '2026-11-01' });

      const done = await patchStatus(created.body.id, {
        status: 'DONE',
        version: 1,
      });
      expect(done.body).toMatchObject({
        status: 'DONE',
        completedAt: NOW_ISO,
        dueStatus: 'completed',
      });
      const [doneRow] = await e2e.dataSource.query(
        'SELECT completed_at FROM content_briefs WHERE id = $1',
        [created.body.id],
      );
      expect(doneRow.completed_at).not.toBeNull();

      const reopened = await patchStatus(created.body.id, {
        status: 'IN_PROGRESS',
        version: 2,
      });
      expect(reopened.body).toMatchObject({
        status: 'IN_PROGRESS',
        completedAt: null,
        dueStatus: 'overdue',
      });
      const [openRow] = await e2e.dataSource.query(
        'SELECT completed_at FROM content_briefs WHERE id = $1',
        [created.body.id],
      );
      expect(openRow.completed_at).toBeNull();
    });

    it('só o status muda: o resto da pauta fica igual', async () => {
      const estate = await createEstateDevelopment('Bela Vista');
      const created = await create({
        title: 'Post',
        description: 'Texto',
        dueDate: '2026-11-20',
        action: 'ANALYZE',
        channel: 'REPORT',
        estateDevelopmentId: estate.id,
      });

      const res = await patchStatus(created.body.id, {
        status: 'IN_REVIEW',
        version: 1,
      });

      expect(res.body).toEqual({
        ...created.body,
        status: 'IN_REVIEW',
        version: 2,
      });
    });

    it('status fora do enum, ausente ou sem version responde 400', async () => {
      const created = await create({ title: 'Post' });

      for (const body of [
        { status: 'CONCLUIDA', version: 1 },
        { version: 1 },
        { status: 'DONE' },
        { status: 'DONE', version: 0 },
        { status: 'DONE', version: 1, title: 'extra' },
      ]) {
        const res = await patchStatus(created.body.id, body);

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INVALID_REQUEST');
      }
    });

    it('id inexistente responde 404', async () => {
      const res = await patchStatus(MISSING_ID, { status: 'DONE', version: 1 });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('CONTENT_BRIEF_NOT_FOUND');
    });
  });

  describe('detalhar (GET /:id)', () => {
    it('devolve a pauta com nomes dos cadastros e auditoria', async () => {
      const estate = await createEstateDevelopment('Bela Vista');
      const owner = await createOwner('Ana');
      const created = await create({
        title: 'Post',
        estateDevelopmentId: estate.id,
        ownerId: owner.id,
      });

      const res = await find(created.body.id);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(created.body);
    });

    it('id inexistente responde 404 CONTENT_BRIEF_NOT_FOUND', async () => {
      const res = await find(MISSING_ID);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('CONTENT_BRIEF_NOT_FOUND');
    });
  });

  describe('excluir (soft delete)', () => {
    it('responde 204 sem corpo; a pauta some do GET e continua no banco com quem excluiu', async () => {
      const created = await create({ title: 'Post' });

      const res = await remove(created.body.id);

      expect(res.status).toBe(204);
      expect(res.body).toBe('');
      expect((await find(created.body.id)).status).toBe(404);
      const [row] = await e2e.dataSource.query(
        'SELECT deleted_at, deleted_by, updated_by FROM content_briefs WHERE id = $1',
        [created.body.id],
      );
      expect(row.deleted_at).not.toBeNull();
      expect(row.deleted_by).toBe('e2e-editor');
      expect(row.updated_by).toBe('e2e-editor');
    });

    it('excluída se comporta como inexistente em GET, PUT, PATCH e DELETE', async () => {
      const created = await create({ title: 'Post' });
      await remove(created.body.id);

      const responses = await Promise.all([
        find(created.body.id),
        put(created.body.id, { title: 'X', version: 1 }),
        patchStatus(created.body.id, { status: 'DONE', version: 1 }),
        remove(created.body.id),
      ]);

      for (const res of responses) {
        expect(res.status).toBe(404);
        expect((res.body as ErrorBody).code).toBe('CONTENT_BRIEF_NOT_FOUND');
      }
    });

    it('id inexistente responde 404', async () => {
      const res = await remove(MISSING_ID);

      expect(res.status).toBe(404);
      expect((res.body as ErrorBody).code).toBe('CONTENT_BRIEF_NOT_FOUND');
    });

    it('excluir não depende da version e não afeta outras pautas', async () => {
      const keep = await create({ title: 'Fica' });
      const gone = await create({ title: 'Some' });
      await put(gone.body.id, { title: 'Some editada', version: 1 });

      expect((await remove(gone.body.id)).status).toBe(204);
      expect((await find(keep.body.id)).status).toBe(200);
    });
  });

  describe('openContentBriefs nos cadastros', () => {
    it('conta as pautas abertas por empreendimento e por responsável', async () => {
      const bela = await createEstateDevelopment('Bela Vista');
      const vila = await createEstateDevelopment('Vila Nova');
      const ana = await createOwner('Ana');
      const bia = await createOwner('Bia');
      expect(
        (await findRegistry(ESTATE_DEVELOPMENTS_URL, bela.id))
          .openContentBriefs,
      ).toBe(0);

      await create({
        title: 'A',
        estateDevelopmentId: bela.id,
        ownerId: ana.id,
      });
      await create({
        title: 'B',
        status: 'IN_PROGRESS',
        estateDevelopmentId: bela.id,
        ownerId: bia.id,
      });
      await create({
        title: 'C',
        estateDevelopmentId: vila.id,
        ownerId: ana.id,
      });
      await create({ title: 'D' });

      const counts = async () => ({
        bela: (await findRegistry(ESTATE_DEVELOPMENTS_URL, bela.id))
          .openContentBriefs,
        vila: (await findRegistry(ESTATE_DEVELOPMENTS_URL, vila.id))
          .openContentBriefs,
        ana: (await findRegistry(OWNERS_URL, ana.id)).openContentBriefs,
        bia: (await findRegistry(OWNERS_URL, bia.id)).openContentBriefs,
      });
      expect(await counts()).toEqual({ bela: 2, vila: 1, ana: 2, bia: 1 });
    });

    it('concluir tira da contagem; reabrir devolve', async () => {
      const estate = await createEstateDevelopment('Bela Vista');
      const owner = await createOwner('Ana');
      const brief = await create({
        title: 'A',
        estateDevelopmentId: estate.id,
        ownerId: owner.id,
      });
      await create({ title: 'B', estateDevelopmentId: estate.id });

      await patchStatus(brief.body.id, { status: 'DONE', version: 1 });
      expect(
        (await findRegistry(ESTATE_DEVELOPMENTS_URL, estate.id))
          .openContentBriefs,
      ).toBe(1);
      expect((await findRegistry(OWNERS_URL, owner.id)).openContentBriefs).toBe(
        0,
      );

      await patchStatus(brief.body.id, { status: 'TODO', version: 2 });
      expect(
        (await findRegistry(ESTATE_DEVELOPMENTS_URL, estate.id))
          .openContentBriefs,
      ).toBe(2);
      expect((await findRegistry(OWNERS_URL, owner.id)).openContentBriefs).toBe(
        1,
      );
    });

    it('criar já concluída não conta; pauta excluída não conta', async () => {
      const estate = await createEstateDevelopment('Bela Vista');
      await create({
        title: 'Concluída',
        status: 'DONE',
        estateDevelopmentId: estate.id,
      });
      const open = await create({
        title: 'Aberta',
        estateDevelopmentId: estate.id,
      });
      expect(
        (await findRegistry(ESTATE_DEVELOPMENTS_URL, estate.id))
          .openContentBriefs,
      ).toBe(1);

      await remove(open.body.id);

      expect(
        (await findRegistry(ESTATE_DEVELOPMENTS_URL, estate.id))
          .openContentBriefs,
      ).toBe(0);
    });

    it('trocar o cadastro da pauta move a contagem', async () => {
      const bela = await createEstateDevelopment('Bela Vista');
      const vila = await createEstateDevelopment('Vila Nova');
      const brief = await create({ title: 'A', estateDevelopmentId: bela.id });

      await put(
        brief.body.id,
        bodyFrom(brief.body, { estateDevelopmentId: vila.id }),
      );

      expect(
        (await findRegistry(ESTATE_DEVELOPMENTS_URL, bela.id))
          .openContentBriefs,
      ).toBe(0);
      expect(
        (await findRegistry(ESTATE_DEVELOPMENTS_URL, vila.id))
          .openContentBriefs,
      ).toBe(1);
    });

    it('as respostas de arquivar e renomear também trazem a contagem; arquivado continua contando', async () => {
      const estate = await createEstateDevelopment('Bela Vista');
      const owner = await createOwner('Ana');
      await create({
        title: 'A',
        estateDevelopmentId: estate.id,
        ownerId: owner.id,
      });
      await create({
        title: 'B',
        estateDevelopmentId: estate.id,
        ownerId: owner.id,
      });

      const archivedEstate = await archive(ESTATE_DEVELOPMENTS_URL, estate.id);
      const renamedOwner = await e2e.client.patch<Registry>(
        `${OWNERS_URL}/${owner.id}`,
        { token: TOKENS.editor, body: { name: 'Ana Lima', version: 1 } },
      );

      expect(archivedEstate.body).toMatchObject({
        active: false,
        openContentBriefs: 2,
      });
      expect(renamedOwner.body).toMatchObject({
        name: 'Ana Lima',
        openContentBriefs: 2,
      });
    });
  });
});
