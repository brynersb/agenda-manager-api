import {
  createPrototypeExamplesSeed,
  SEED_ACTOR,
} from '@/database/seeds/prototype-examples.seed';
import { cleanDatabase } from '../../src/core/database';
import { TOKENS } from '../../src/core/tokens';
import { type AppE2e, bootstrapApp } from '../../src/runner/app-bootstrap';

type ContentBrief = {
  title: string;
  dueDate: string | null;
  dueStatus: string;
  status: string;
  action: string | null;
  channel: string | null;
  estateDevelopment: { name: string } | null;
  owner: { name: string } | null;
  completedAt: string | null;
  createdBy: { id: string; name: string | null };
};

type Page = { data: ContentBrief[]; total: number };
type Registry = { name: string };

describe('Seed de exemplos do protótipo (e2e)', () => {
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

  const runSeed = () =>
    createPrototypeExamplesSeed(() => e2e.clock).execute(e2e.dataSource);

  const list = () =>
    e2e.client.get<Page>('/api/v1/content-briefs?limit=200', {
      token: TOKENS.editor,
    });

  it('cria as 6 pautas, 2 empreendimentos e 2 responsáveis em português', async () => {
    await runSeed();

    const briefs = await list();
    const estateDevelopments = await e2e.client.get<Registry[]>(
      '/api/v1/estate-developments',
      { token: TOKENS.editor },
    );
    const owners = await e2e.client.get<Registry[]>('/api/v1/owners', {
      token: TOKENS.editor,
    });

    expect(briefs.body.total).toBe(6);
    expect(estateDevelopments.body.map((item) => item.name)).toEqual([
      'Comercial Exemplo',
      'Residencial Exemplo',
    ]);
    expect(owners.body.map((item) => item.name)).toEqual(['Ana', 'Bruno']);
    expect(briefs.body.data.map((item) => item.title).sort()).toEqual([
      'Acompanhar leads do Google Ads',
      'Analisar resultados de outubro',
      'Cobrar fotos da evolução da obra',
      'Criar arte do plantão de vendas',
      'Desenvolver página de lançamento',
      'Pagamento da agência de mídia paga',
    ]);
  });

  it('as pautas cobrem as seis situações do prazo e usam enums em inglês', async () => {
    await runSeed();

    const { body } = await list();

    expect(body.data.map((item) => item.dueStatus).sort()).toEqual([
      'completed',
      'later',
      'next-7-days',
      'no-due-date',
      'overdue',
      'today',
    ]);
    const photos = body.data.find((item) => item.title.startsWith('Cobrar'));
    expect(photos).toMatchObject({
      dueDate: '2026-11-12',
      status: 'IN_PROGRESS',
      action: 'CHASE',
      channel: null,
      estateDevelopment: { name: 'Residencial Exemplo' },
      owner: { name: 'Ana' },
    });
    const done = body.data.find((item) => item.status === 'DONE');
    expect(done).toMatchObject({
      dueDate: '2026-11-10',
      action: 'ANALYZE',
      channel: 'REPORT',
    });
    expect(done?.completedAt).not.toBeNull();
    for (const item of body.data) {
      expect(item.createdBy).toEqual({
        id: SEED_ACTOR.id,
        name: SEED_ACTOR.name,
      });
    }
  });

  it('é idempotente: rodar de novo não duplica nada', async () => {
    await runSeed();
    await runSeed();

    const briefs = await list();
    const counts = await e2e.dataSource.query(
      `SELECT (SELECT count(*)::int FROM estate_developments) AS estate_developments,
              (SELECT count(*)::int FROM owners) AS owners`,
    );

    expect(briefs.body.total).toBe(6);
    expect(counts).toEqual([{ estate_developments: 2, owners: 2 }]);
  });

  it('reaproveita cadastros que já existem (mesmo nome sem acento e caixa)', async () => {
    const created = await e2e.client.post<{ id: string }>('/api/v1/owners', {
      token: TOKENS.editor,
      body: { name: 'ANA' },
    });

    await runSeed();

    const owners = await e2e.client.get<Registry[]>('/api/v1/owners', {
      token: TOKENS.editor,
    });
    expect(owners.body.map((item) => item.name)).toEqual(['ANA', 'Bruno']);
    expect(created.status).toBe(201);
  });
});
