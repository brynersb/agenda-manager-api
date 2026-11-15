import {
  buildCorsOptions,
  parseCorsOrigins,
} from '@/shared/infrastructure/http/cors.config';

describe('cors.config', () => {
  it('separa o CSV e remove espaços e itens vazios', () => {
    expect(parseCorsOrigins(' http://a.com , ,http://b.com,')).toEqual([
      'http://a.com',
      'http://b.com',
    ]);
  });

  it('usa só as origens informadas e expõe o x-request-id', () => {
    const options = buildCorsOptions(['http://a.com']);

    expect(options.origin).toEqual(['http://a.com']);
    expect(options.exposedHeaders).toContain('x-request-id');
  });
});
