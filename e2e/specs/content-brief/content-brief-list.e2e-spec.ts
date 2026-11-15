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
  updatedAt: string;
};

type Page = {
  data: ContentBrief[];
  total: number;
  page: number;
  limit: number;
};

type Summary = {
  today: string;
  total: number;
  byDueStatus: Record<string, number>;
  byStatus: Record<string, number>;
};

type Registry = { id: string; name: string };

type ErrorBody = {
  statusCode: number;
  code: string;
  message: string;
  fields?: { field: string; message: string }[];
};

type NewBrief = {
  title: string;
  description?: string;
  /** Dias a partir de "hoje" (`2026-11-14`); ausente ou `null` = sem prazo. */
  dueInDays?: number | null;
  status?: string;
  action?: string;
  channel?: string;
  estateDevelopmentId?: string;
  ownerId?: string;
};

const URL = '/api/v1/content-briefs';
const SUMMARY_URL = `${URL}/summary`;
const TODAY = '2026-11-14';
const DUE_STATUSES = [
  'overdue',
  'today',
  'next-7-days',
  'later',
  'no-due-date',
  'completed',
] as const;
const STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] as const;

function dueDateIn(days: number, from: string = TODAY): string {
  return new Date(Date.parse(`${from}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

describe('Listagem e resumo de pautas (e2e)', () => {
  let e2e: AppE2e;

  beforeAll(async () => {
    e2e = await bootstrapApp();
  });

  afterAll(async () => {
    await e2e.close();
  });

  beforeEach(async () => {
    await cleanDatabase(e2e.dataSource);
    e2e.clock.setToday(TODAY);
  });

  const make = async (brief: NewBrief): Promise<ContentBrief> => {
    const { dueInDays, ...rest } = brief;
    const res = await e2e.client.post<ContentBrief & ErrorBody>(URL, {
      token: TOKENS.editor,
      body: {
        ...rest,
        dueDate:
          dueInDays === undefined || dueInDays === null
            ? undefined
            : dueDateIn(dueInDays),
      },
    });
    expect(res.status).toBe(201);
    return res.body;
  };

  const makeRegistry = async (
    resource: 'estate-developments' | 'owners',
    name: string,
  ): Promise<Registry> => {
    const res = await e2e.client.post<Registry>(`/api/v1/${resource}`, {
      token: TOKENS.editor,
      body: { name },
    });
    expect(res.status).toBe(201);
    return res.body;
  };

  const list = (query = '', token: string = TOKENS.editor) =>
    e2e.client.get<Page & ErrorBody>(query ? `${URL}?${query}` : URL, {
      token,
    });

  const summary = (query = '', token: string = TOKENS.editor) =>
    e2e.client.get<Summary & ErrorBody>(
      query ? `${SUMMARY_URL}?${query}` : SUMMARY_URL,
      { token },
    );

  const titlesOf = async (query: string): Promise<string[]> => {
    const res = await list(query);
    expect(res.status).toBe(200);
    return res.body.data.map((brief) => brief.title);
  };

  /** Uma pauta em cada fronteira de data em torno de "hoje" (14/11/2026). */
  const makeBoundaries = async () => {
    await make({ title: 'Ontem', dueInDays: -1 });
    await make({ title: 'Hoje', dueInDays: 0 });
    await make({ title: 'Amanhã', dueInDays: 1 });
    await make({ title: 'Em 7 dias', dueInDays: 7 });
    await make({ title: 'Em 8 dias', dueInDays: 8 });
    await make({ title: 'Sem prazo' });
    await make({ title: 'Concluída vencida', dueInDays: -5, status: 'DONE' });
  };

  describe('situação do prazo (dueStatus)', () => {
    beforeEach(makeBoundaries);

    it.each([
      ['overdue', ['Ontem']],
      ['today', ['Hoje']],
      ['next-7-days', ['Amanhã', 'Em 7 dias']],
      ['later', ['Em 8 dias']],
      ['no-due-date', ['Sem prazo']],
      ['completed', ['Concluída vencida']],
    ])('%s isolado nas fronteiras de data', async (dueStatus, expected) => {
      const res = await list(`dueStatus=${dueStatus}`);

      expect(res.status).toBe(200);
      expect(res.body.data.map((brief) => brief.title).sort()).toEqual(
        [...expected].sort(),
      );
      expect(res.body.total).toBe(expected.length);
    });

    it('concluída com prazo vencido não é overdue', async () => {
      const overdue = await titlesOf('dueStatus=overdue');
      const done = await list('dueStatus=completed');

      expect(overdue).not.toContain('Concluída vencida');
      expect(done.body.data[0]).toMatchObject({
        dueStatus: 'completed',
        daysUntilDue: -5,
      });
    });

    it('vários valores combinam com OR', async () => {
      expect((await titlesOf('dueStatus=overdue,today')).sort()).toEqual([
        'Hoje',
        'Ontem',
      ]);
      expect(
        (await titlesOf('dueStatus=next-7-days,later,no-due-date')).sort(),
      ).toEqual(['Amanhã', 'Em 7 dias', 'Em 8 dias', 'Sem prazo']);
    });

    it('as cinco situações abertas excluem só a concluída', async () => {
      const titles = await titlesOf(
        'dueStatus=overdue,today,next-7-days,later,no-due-date',
      );

      expect(titles).toHaveLength(6);
      expect(titles).not.toContain('Concluída vencida');
    });

    it('sem dueStatus devolve tudo', async () => {
      expect((await list()).body.total).toBe(7);
    });

    it('o filtro SQL e a classificação em memória concordam em todas as fronteiras', async () => {
      for (let days = -3; days <= 10; days++) {
        await make({ title: `Dia ${days}`, dueInDays: days });
      }
      await make({ title: 'Concluída hoje', dueInDays: 0, status: 'DONE' });
      await make({ title: 'Concluída sem prazo', status: 'DONE' });

      const all = await list('limit=200');
      let counted = 0;
      for (const dueStatus of DUE_STATUSES) {
        const filtered = await list(`dueStatus=${dueStatus}&limit=200`);
        expect(filtered.body.data.length).toBeGreaterThan(0);
        for (const brief of filtered.body.data) {
          expect(brief.dueStatus).toBe(dueStatus);
        }
        counted += filtered.body.total;
      }

      expect(counted).toBe(all.body.total);
      expect(
        all.body.data.every((brief) =>
          DUE_STATUSES.includes(brief.dueStatus as never),
        ),
      ).toBe(true);
    });

    it('"hoje" vem do relógio da aplicação: mudar o dia reclassifica', async () => {
      e2e.clock.setToday('2026-11-21');

      expect((await titlesOf('dueStatus=overdue')).sort()).toEqual([
        'Amanhã',
        'Hoje',
        'Ontem',
      ]);
      expect(await titlesOf('dueStatus=today')).toEqual(['Em 7 dias']);
      expect(await titlesOf('dueStatus=next-7-days')).toEqual(['Em 8 dias']);
      expect(await titlesOf('dueStatus=later')).toEqual([]);
    });
  });

  describe('filtros de cadastro, status e ação', () => {
    it('none em empreendimento e em responsável, e uuid', async () => {
      const estateDevelopment = await makeRegistry(
        'estate-developments',
        'Bela Vista',
      );
      const owner = await makeRegistry('owners', 'Ana');
      await make({
        title: 'Com os dois',
        estateDevelopmentId: estateDevelopment.id,
        ownerId: owner.id,
      });
      await make({
        title: 'Só empreendimento',
        estateDevelopmentId: estateDevelopment.id,
      });
      await make({ title: 'Só responsável', ownerId: owner.id });
      await make({ title: 'Sem nenhum' });

      expect((await titlesOf('estateDevelopmentId=none')).sort()).toEqual([
        'Sem nenhum',
        'Só responsável',
      ]);
      expect((await titlesOf('ownerId=none')).sort()).toEqual([
        'Sem nenhum',
        'Só empreendimento',
      ]);
      expect(await titlesOf('estateDevelopmentId=none&ownerId=none')).toEqual([
        'Sem nenhum',
      ]);
      expect(
        (await titlesOf(`estateDevelopmentId=${estateDevelopment.id}`)).sort(),
      ).toEqual(['Com os dois', 'Só empreendimento']);
      expect(
        await titlesOf(
          `estateDevelopmentId=${estateDevelopment.id}&ownerId=${owner.id}`,
        ),
      ).toEqual(['Com os dois']);
    });

    it('uuid inexistente não devolve nada (sem erro)', async () => {
      await make({ title: 'Qualquer' });

      const res = await list('ownerId=0192f6a0-7c1e-7a3b-9d52-4f1e8b6c2a10');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ data: [], total: 0 });
    });

    it('status em CSV combina com OR', async () => {
      await make({ title: 'A', status: 'TODO' });
      await make({ title: 'B', status: 'IN_PROGRESS' });
      await make({ title: 'C', status: 'IN_REVIEW' });
      await make({ title: 'D', status: 'DONE' });

      expect((await titlesOf('status=TODO,DONE')).sort()).toEqual(['A', 'D']);
      expect(await titlesOf('status=IN_REVIEW')).toEqual(['C']);
    });

    it('action filtra pela ação', async () => {
      await make({ title: 'Cobrar', action: 'CHASE' });
      await make({ title: 'Criar', action: 'CREATE' });
      await make({ title: 'Sem ação' });

      expect(await titlesOf('action=CHASE')).toEqual(['Cobrar']);
    });

    it('filtros diferentes combinam com AND', async () => {
      const owner = await makeRegistry('owners', 'Ana');
      await make({
        title: 'Atrasada da Ana',
        dueInDays: -2,
        ownerId: owner.id,
      });
      await make({ title: 'Atrasada sem dono', dueInDays: -2 });
      await make({ title: 'Futura da Ana', dueInDays: 20, ownerId: owner.id });

      expect(await titlesOf(`dueStatus=overdue&ownerId=${owner.id}`)).toEqual([
        'Atrasada da Ana',
      ]);
    });
  });

  describe('busca (q)', () => {
    it('ignora acento e caixa nos dois sentidos', async () => {
      await make({ title: 'Criar arte do plantão de vendas' });
      await make({ title: 'Outra coisa' });
      await make({ title: 'PLANTAO NOTURNO' });

      expect((await titlesOf('q=plantao')).sort()).toEqual([
        'Criar arte do plantão de vendas',
        'PLANTAO NOTURNO',
      ]);
      expect(
        (await titlesOf(`q=${encodeURIComponent('PLANTÃO')}`)).sort(),
      ).toEqual(['Criar arte do plantão de vendas', 'PLANTAO NOTURNO']);
      expect(
        await titlesOf(`q=${encodeURIComponent('plantão de vendas')}`),
      ).toEqual(['Criar arte do plantão de vendas']);
    });

    it('procura na descrição', async () => {
      await make({
        title: 'Sem pista',
        description: 'Incluir QR code na arte',
      });
      await make({ title: 'Outra' });

      expect(await titlesOf('q=qr%20code')).toEqual(['Sem pista']);
    });

    it('procura no nome do empreendimento e do responsável, sem acento', async () => {
      const estateDevelopment = await makeRegistry(
        'estate-developments',
        'Residencial Ipê',
      );
      const owner = await makeRegistry('owners', 'José');
      await make({
        title: 'Pelo empreendimento',
        estateDevelopmentId: estateDevelopment.id,
      });
      await make({ title: 'Pelo responsável', ownerId: owner.id });
      await make({ title: 'Nenhum dos dois' });

      expect(await titlesOf('q=ipe')).toEqual(['Pelo empreendimento']);
      expect(await titlesOf('q=jose')).toEqual(['Pelo responsável']);
    });

    it('procura nos rótulos de ação e de canal', async () => {
      await make({ title: 'Fotos da obra', action: 'CHASE' });
      await make({ title: 'Leads', channel: 'ADS' });
      await make({ title: 'Vídeo da obra', channel: 'VIDEO' });
      await make({ title: 'Relatório', channel: 'REPORT', action: 'ANALYZE' });
      await make({ title: 'Sem nada' });

      expect(await titlesOf('q=cobrar')).toEqual(['Fotos da obra']);
      expect(await titlesOf('q=anuncios')).toEqual(['Leads']);
      expect(await titlesOf('q=ANÚNCIOS')).toEqual(['Leads']);
      expect(await titlesOf('q=relatorio')).toEqual(['Relatório']);
      expect(await titlesOf('q=analisar')).toEqual(['Relatório']);
    });

    it('% e _ valem como texto, não como curinga', async () => {
      await make({ title: 'Desconto de 100%' });
      await make({ title: 'Item 100 mais' });
      await make({ title: 'a_c' });
      await make({ title: 'abc' });
      await make({ title: 'C:\\pasta' });

      expect(await titlesOf(`q=${encodeURIComponent('100%')}`)).toEqual([
        'Desconto de 100%',
      ]);
      expect(await titlesOf('q=a_c')).toEqual(['a_c']);
      expect(await titlesOf(`q=${encodeURIComponent('%%')}`)).toEqual([]);
      expect(await titlesOf(`q=${encodeURIComponent('__')}`)).toEqual([]);
      expect(await titlesOf(`q=${encodeURIComponent('C:\\p')}`)).toEqual([
        'C:\\pasta',
      ]);
    });

    it('uma tentativa de injeção de SQL vira só texto', async () => {
      await make({ title: 'Normal' });

      const res = await list(
        `q=${encodeURIComponent("'; DROP TABLE content_briefs; --")}`,
      );

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(0);
      expect((await list()).body.total).toBe(1);
    });

    it('combina com os outros filtros', async () => {
      await make({ title: 'Plantão atrasado', dueInDays: -1 });
      await make({ title: 'Plantão futuro', dueInDays: 30 });

      expect(await titlesOf('q=plantao&dueStatus=overdue')).toEqual([
        'Plantão atrasado',
      ]);
    });

    it('o total respeita a busca e a paginação', async () => {
      for (let index = 1; index <= 5; index++) {
        await make({ title: `Plantão ${index}` });
      }
      await make({ title: 'Outra' });

      const res = await list('q=plantao&limit=2&page=3');

      expect(res.body).toMatchObject({ total: 5, page: 3, limit: 2 });
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('ordenação (sort)', () => {
    const makeSortable = async () => {
      await make({ title: 'Bruno tarefa', dueInDays: 3 });
      await make({ title: 'Álvaro tarefa', dueInDays: 3 });
      await make({ title: 'abc', dueInDays: 3 });
      await make({ title: 'Zeta', dueInDays: 1 });
      await make({ title: 'Sem prazo B' });
      await make({ title: 'Sem prazo A' });
    };

    it('dueDate (padrão): prazo crescente, sem prazo por último, título em pt-BR', async () => {
      await makeSortable();
      const expected = [
        'Zeta',
        'abc',
        'Álvaro tarefa',
        'Bruno tarefa',
        'Sem prazo A',
        'Sem prazo B',
      ];

      expect(await titlesOf('')).toEqual(expected);
      expect(await titlesOf('sort=dueDate')).toEqual(expected);
    });

    it('-dueDate: prazo decrescente, mas sem prazo continua por último', async () => {
      await makeSortable();

      expect(await titlesOf('sort=-dueDate')).toEqual([
        'abc',
        'Álvaro tarefa',
        'Bruno tarefa',
        'Zeta',
        'Sem prazo A',
        'Sem prazo B',
      ]);
    });

    it('updatedAt: alteradas mais recentemente primeiro', async () => {
      const first = await make({ title: 'Primeira' });
      const second = await make({ title: 'Segunda' });
      await make({ title: 'Terceira' });
      e2e.clock.setToday('2026-11-15');
      const patched = await e2e.client.patch<ContentBrief>(
        `${URL}/${second.id}/status`,
        {
          token: TOKENS.editor,
          body: { status: 'IN_PROGRESS', version: second.version },
        },
      );
      expect(patched.status).toBe(200);

      const titles = await titlesOf('sort=updatedAt');

      expect(titles[0]).toBe('Segunda');
      expect(titles.slice(1)).toEqual(['Primeira', 'Terceira']);
      expect(first.title).toBe('Primeira');
    });
  });

  describe('paginação', () => {
    const makeFive = async () => {
      for (let index = 1; index <= 5; index++) {
        await make({ title: `P${index}`, dueInDays: index });
      }
    };

    it('padrão: page 1, limit 50', async () => {
      await makeFive();

      const res = await list();

      expect(res.body).toMatchObject({ total: 5, page: 1, limit: 50 });
      expect(res.body.data).toHaveLength(5);
    });

    it('páginas seguem a ordenação, sem repetir nem pular item', async () => {
      await makeFive();

      const first = await list('limit=2&page=1');
      const second = await list('limit=2&page=2');
      const third = await list('limit=2&page=3');

      expect(first.body).toMatchObject({ total: 5, page: 1, limit: 2 });
      expect(first.body.data.map((b) => b.title)).toEqual(['P1', 'P2']);
      expect(second.body.data.map((b) => b.title)).toEqual(['P3', 'P4']);
      expect(third.body.data.map((b) => b.title)).toEqual(['P5']);
      expect(third.body.total).toBe(5);
    });

    it('página além da última: 200 com data vazio e o total correto', async () => {
      await makeFive();

      const res = await list('limit=2&page=9');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ data: [], total: 5, page: 9, limit: 2 });
    });

    it('lista vazia: 200 com data vazio', async () => {
      const res = await list();

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: [], total: 0, page: 1, limit: 50 });
    });

    it('limit 200 é o máximo aceito', async () => {
      const res = await list('limit=200');

      expect(res.status).toBe(200);
      expect(res.body.limit).toBe(200);
    });
  });

  describe('pautas excluídas', () => {
    it('nunca aparecem na lista, na busca nem no resumo', async () => {
      await make({ title: 'Fica', dueInDays: -1 });
      const removed = await make({ title: 'Some', dueInDays: -1 });
      const res = await e2e.client.delete(`${URL}/${removed.id}`, {
        token: TOKENS.editor,
      });
      expect(res.status).toBe(204);

      expect(await titlesOf('')).toEqual(['Fica']);
      expect(await titlesOf('dueStatus=overdue')).toEqual(['Fica']);
      expect(await titlesOf('q=some')).toEqual([]);
      const counts = await summary();
      expect(counts.body.total).toBe(1);
      expect(counts.body.byDueStatus.overdue).toBe(1);
    });
  });

  describe('forma da resposta', () => {
    it('cada item traz dueStatus, daysUntilDue e os cadastros com o nome atual', async () => {
      const estateDevelopment = await makeRegistry(
        'estate-developments',
        'Bela Vista',
      );
      const owner = await makeRegistry('owners', 'Ana');
      await make({
        title: 'Completa',
        description: 'Texto',
        dueInDays: 2,
        action: 'CREATE',
        channel: 'INSTAGRAM',
        estateDevelopmentId: estateDevelopment.id,
        ownerId: owner.id,
      });
      const archived = await e2e.client.post(
        `/api/v1/estate-developments/${estateDevelopment.id}/archive`,
        { token: TOKENS.editor },
      );
      expect(archived.status).toBe(200);

      const res = await list();

      expect(res.body.data[0]).toMatchObject({
        title: 'Completa',
        description: 'Texto',
        dueDate: '2026-11-16',
        dueStatus: 'next-7-days',
        daysUntilDue: 2,
        status: 'TODO',
        action: 'CREATE',
        channel: 'INSTAGRAM',
        estateDevelopment: {
          id: estateDevelopment.id,
          name: 'Bela Vista',
          active: false,
        },
        owner: { id: owner.id, name: 'Ana', active: true },
        completedAt: null,
        version: 1,
        createdBy: { id: 'e2e-editor', name: 'Editor E2E' },
      });
    });

    it('é igual ao detalhe por id', async () => {
      const created = await make({ title: 'Igual', dueInDays: 4 });

      const detail = await e2e.client.get<ContentBrief>(
        `${URL}/${created.id}`,
        {
          token: TOKENS.editor,
        },
      );
      const listed = await list();

      expect(listed.body.data[0]).toEqual(detail.body);
    });
  });

  describe('GET /content-briefs/summary', () => {
    it('banco vazio: todas as chaves presentes, com zero', async () => {
      const res = await summary();

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        today: TODAY,
        total: 0,
        byDueStatus: {
          overdue: 0,
          today: 0,
          'next-7-days': 0,
          later: 0,
          'no-due-date': 0,
          completed: 0,
        },
        byStatus: { TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 0 },
      });
    });

    it('conta por situação do prazo e por status nas fronteiras', async () => {
      await makeBoundaries();
      await make({
        title: 'Em andamento',
        dueInDays: 30,
        status: 'IN_PROGRESS',
      });
      await make({ title: 'Em revisão', status: 'IN_REVIEW' });

      const res = await summary();

      expect(res.body).toEqual({
        today: TODAY,
        total: 9,
        byDueStatus: {
          overdue: 1,
          today: 1,
          'next-7-days': 2,
          later: 2,
          'no-due-date': 2,
          completed: 1,
        },
        byStatus: { TODO: 6, IN_PROGRESS: 1, IN_REVIEW: 1, DONE: 1 },
      });
    });

    it('é consistente com a lista: cada contagem é o total da lista filtrada', async () => {
      await makeBoundaries();
      await make({
        title: 'Em andamento',
        dueInDays: 30,
        status: 'IN_PROGRESS',
      });
      const counts = await summary();

      for (const dueStatus of DUE_STATUSES) {
        const filtered = await list(`dueStatus=${dueStatus}`);
        expect(counts.body.byDueStatus[dueStatus]).toBe(filtered.body.total);
      }
      for (const status of STATUSES) {
        const filtered = await list(`status=${status}`);
        expect(counts.body.byStatus[status]).toBe(filtered.body.total);
      }
      const sumByDueStatus = Object.values(counts.body.byDueStatus).reduce(
        (total, value) => total + value,
        0,
      );
      const sumByStatus = Object.values(counts.body.byStatus).reduce(
        (total, value) => total + value,
        0,
      );
      expect(sumByDueStatus).toBe(counts.body.total);
      expect(sumByStatus).toBe(counts.body.total);
      expect(counts.body.total).toBe((await list()).body.total);
    });

    it('aplica status, cadastros, ação e busca, como a lista', async () => {
      const owner = await makeRegistry('owners', 'Ana');
      await make({
        title: 'Plantão A',
        dueInDays: -1,
        ownerId: owner.id,
        action: 'CREATE',
      });
      await make({ title: 'Plantão B', dueInDays: 3, action: 'CREATE' });
      await make({ title: 'Plantão C', dueInDays: 3, status: 'DONE' });
      await make({ title: 'Outra', dueInDays: 3 });

      const bySearch = await summary('q=plantao');
      const byOwner = await summary(`ownerId=${owner.id}`);
      const byNoOwner = await summary('ownerId=none&action=CREATE');
      const byStatus = await summary('status=DONE');

      expect(bySearch.body.total).toBe(3);
      expect(byOwner.body).toMatchObject({
        total: 1,
        byDueStatus: { overdue: 1 },
      });
      expect(byNoOwner.body.total).toBe(1);
      expect(byStatus.body).toMatchObject({
        total: 1,
        byStatus: { DONE: 1, TODO: 0 },
        byDueStatus: { completed: 1 },
      });
    });

    it('ignora dueStatus, page, limit e sort', async () => {
      await makeBoundaries();
      const plain = await summary();

      const ignored = await summary(
        'dueStatus=overdue&page=3&limit=1&sort=-dueDate',
      );

      expect(ignored.status).toBe(200);
      expect(ignored.body).toEqual(plain.body);
    });

    it('"summary" não é lido como id de pauta', async () => {
      const res = await summary();

      expect(res.status).toBe(200);
    });

    it('acompanha o relógio da aplicação', async () => {
      await make({ title: 'Amanhã', dueInDays: 1 });
      e2e.clock.setToday('2026-11-15');

      const res = await summary();

      expect(res.body.today).toBe('2026-11-15');
      expect(res.body.byDueStatus.today).toBe(1);
    });
  });

  describe('papéis', () => {
    it('viewer lista e resume (200)', async () => {
      await make({ title: 'Qualquer' });

      const listed = await list('', TOKENS.viewer);
      const counts = await summary('', TOKENS.viewer);

      expect(listed.status).toBe(200);
      expect(listed.body.total).toBe(1);
      expect(counts.status).toBe(200);
      expect(counts.body.total).toBe(1);
    });

    it('usuário sem papel recebe 403 FORBIDDEN', async () => {
      const listed = await list('', TOKENS.noRole);
      const counts = await summary('', TOKENS.noRole);

      expect(listed.status).toBe(403);
      expect(listed.body.code).toBe('FORBIDDEN');
      expect(counts.status).toBe(403);
      expect(counts.body.code).toBe('FORBIDDEN');
    });

    it('sem token recebe 401 UNAUTHENTICATED', async () => {
      const listed = await e2e.client.get<ErrorBody>(URL);
      const counts = await e2e.client.get<ErrorBody>(SUMMARY_URL);

      expect(listed.status).toBe(401);
      expect(listed.body.code).toBe('UNAUTHENTICATED');
      expect(counts.status).toBe(401);
      expect(counts.body.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('validação (400 INVALID_REQUEST com fields)', () => {
    it.each([
      ['limit', 'limit=201'],
      ['limit', 'limit=0'],
      ['page', 'page=0'],
      ['q', 'q=a'],
      ['q', `q=${'x'.repeat(101)}`],
      ['dueStatus', 'dueStatus=overdue,atrasada'],
      ['status', 'status=A_FAZER'],
      ['action', 'action=COBRAR'],
      ['sort', 'sort=title'],
      ['estateDevelopmentId', 'estateDevelopmentId=abc'],
      ['ownerId', 'ownerId=nenhum'],
      ['foo', 'foo=1'],
    ])('lista recusa %s inválido (%s)', async (field, query) => {
      const res = await list(query);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_REQUEST');
      expect(res.body.fields?.map((item) => item.field)).toContain(field);
      for (const item of res.body.fields ?? []) {
        expect(item.message.length).toBeGreaterThan(0);
      }
    });

    it.each([
      ['q', 'q=a'],
      ['status', 'status=X'],
      ['ownerId', 'ownerId=abc'],
      ['estateDevelopmentId', 'estateDevelopmentId=abc'],
      ['action', 'action=X'],
    ])('resumo recusa %s inválido (%s)', async (field, query) => {
      const res = await summary(query);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_REQUEST');
      expect(res.body.fields?.map((item) => item.field)).toContain(field);
    });

    it('a mensagem de q é em pt-BR', async () => {
      const res = await list('q=a');

      expect(res.body.fields).toEqual([
        { field: 'q', message: 'A busca deve ter entre 2 e 100 caracteres' },
      ]);
    });
  });
});
