import { type AppE2e, bootstrapApp } from '../../src/runner/app-bootstrap';

describe('Contrato de erro e superfície HTTP (e2e)', () => {
  let e2e: AppE2e;

  beforeAll(async () => {
    e2e = await bootstrapApp();
  });

  afterAll(async () => {
    await e2e.close();
  });

  it('rota inexistente devolve 404 NOT_FOUND no corpo padrão', async () => {
    const res =
      await e2e.client.get<Record<string, unknown>>('/api/v1/qualquer');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Recurso não encontrado',
    });
    expect(res.headers.get('x-request-id')).toBeTruthy();
  });

  it('JSON malformado devolve 400 INVALID_REQUEST', async () => {
    const res = await e2e.client.post<Record<string, unknown>>(
      '/api/v1/qualquer',
      { body: '{ nao é json', headers: { 'content-type': 'application/json' } },
    );

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'INVALID_REQUEST' });
  });

  it('corpo acima de 100 kb é recusado', async () => {
    const res = await e2e.client.post('/api/v1/qualquer', {
      body: { text: 'x'.repeat(200 * 1024) },
    });

    expect(res.status).toBe(413);
  });

  it('envia os cabeçalhos de segurança do helmet', async () => {
    const res = await e2e.client.get('/health');

    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-powered-by')).toBeNull();
  });

  it('responde ao preflight de CORS só para a origem permitida', async () => {
    const allowed = await e2e.client.request('OPTIONS', '/api/v1/qualquer', {
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'GET',
      },
    });
    const denied = await e2e.client.request('OPTIONS', '/api/v1/qualquer', {
      headers: {
        origin: 'http://malicioso.example',
        'access-control-request-method': 'GET',
      },
    });

    expect(allowed.headers.get('access-control-allow-origin')).toBe(
      'http://localhost:5173',
    );
    expect(denied.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('serve o Swagger em /docs', async () => {
    const res = await e2e.client.get<string>('/docs');

    expect(res.status).toBe(200);
    expect(res.body).toContain('swagger');
  });
});
