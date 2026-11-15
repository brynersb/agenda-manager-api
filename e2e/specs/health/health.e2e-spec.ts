import { cleanDatabase } from '../../src/core/database';
import { type AppE2e, bootstrapApp } from '../../src/runner/app-bootstrap';

type HealthBody = {
  status: string;
  info: { database?: { status: string } };
  error: { database?: { status: string } };
};

describe('Health (e2e)', () => {
  let e2e: AppE2e;

  beforeAll(async () => {
    e2e = await bootstrapApp();
  });

  afterAll(async () => {
    await e2e.close();
  });

  it('GET /health responde 200 sem prefixo /api, com database: up e x-request-id', async () => {
    const res = await e2e.client.get<HealthBody>('/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      info: { database: { status: 'up' } },
    });
    expect(res.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('reaproveita o x-request-id enviado pelo cliente', async () => {
    const res = await e2e.client.get('/health', {
      headers: { 'x-request-id': 'teste-123' },
    });

    expect(res.headers.get('x-request-id')).toBe('teste-123');
  });

  it('não expõe o health sob /api/v1', async () => {
    const res = await e2e.client.get('/api/v1/health');

    expect(res.status).toBe(404);
  });

  it('migrations aplicadas: unaccent, immutable_unaccent e colação pt_br', async () => {
    const [{ no_accent }] = await e2e.dataSource.query(
      `SELECT immutable_unaccent('Ação Épica') AS no_accent`,
    );
    const sorted: { v: string }[] = await e2e.dataSource.query(
      `SELECT v FROM (VALUES ('b'), ('á'), ('a')) AS t(v) ORDER BY v COLLATE "pt_br"`,
    );

    expect(no_accent).toBe('Acao Epica');
    expect(sorted.map(({ v }) => v)).toEqual(['a', 'á', 'b']);
  });

  it('cleanDatabase funciona sem tabelas de negócio e preserva as migrations', async () => {
    await cleanDatabase(e2e.dataSource);

    const [{ total }] = await e2e.dataSource.query(
      'SELECT count(*)::int AS total FROM migrations',
    );
    expect(total).toBeGreaterThanOrEqual(1);
  });

  it('GET /health responde 503 com database: down quando o banco cai', async () => {
    const databaseDown = await bootstrapApp();
    try {
      await databaseDown.dataSource.destroy();

      const res = await databaseDown.client.get<HealthBody>('/health');

      expect(res.status).toBe(503);
      expect(res.body).toMatchObject({
        status: 'error',
        error: { database: { status: 'down' } },
      });
    } finally {
      await databaseDown.close();
    }
  });
});
