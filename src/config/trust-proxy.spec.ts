import { parseTrustProxy } from '@/config/trust-proxy';

describe('parseTrustProxy', () => {
  it.each([[undefined], [''], ['  '], ['false'], ['FALSE'], ['0']])(
    'trata %j como sem confiança em proxy (false)',
    (raw) => {
      expect(parseTrustProxy(raw)).toEqual({ ok: true, value: false });
    },
  );

  it.each([
    ['1', 1],
    ['2', 2],
    [' 3 ', 3],
    ['10', 10],
    [1, 1],
  ])('aceita %j saltos', (raw, hops) => {
    expect(parseTrustProxy(raw)).toEqual({ ok: true, value: hops });
  });

  it.each([
    ['10.0.0.1', ['10.0.0.1']],
    ['10.0.0.0/8', ['10.0.0.0/8']],
    [
      '10.0.0.0/8, 172.16.0.0/12 ,192.168.0.0/16',
      ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'],
    ],
    ['::1', ['::1']],
    ['fc00::/7', ['fc00::/7']],
    ['loopback,uniquelocal', ['loopback', 'uniquelocal']],
    ['1.2.3.4/32', ['1.2.3.4/32']],
  ])('aceita a lista %j', (raw, entries) => {
    expect(parseTrustProxy(raw)).toEqual({ ok: true, value: entries });
  });

  it.each([['true'], ['TRUE'], ['  true ']])(
    'recusa %j (true puro permitiria falsificar o IP)',
    (raw) => {
      const result = parseTrustProxy(raw);
      expect(result.ok).toBe(false);
      expect(result).toMatchObject({
        message: expect.stringMatching(/não aceita "true".*falsificar o IP/),
      });
    },
  );

  it.each([
    ['11', /no máximo 10 saltos/],
    ['100', /no máximo 10 saltos/],
    ['-1', /não é um IP nem uma sub-rede/],
    ['1.5', /não é um IP nem uma sub-rede/],
    ['abc', /não é um IP nem uma sub-rede/],
    ['10.0.0.0/33', /prefixo de sub-rede inválido/],
    ['10.0.0.0/x', /prefixo de sub-rede inválido/],
    ['fc00::/129', /prefixo de sub-rede inválido/],
    ['10.0.0.0/8/8', /não é um IP nem uma sub-rede/],
    ['10.0.0.1,,10.0.0.2', /entrada vazia/],
    ['10.0.0.1,true', /não aceita "true" dentro da lista/],
    ['0.0.0.0/0', /confia em qualquer origem/],
    ['::/0', /confia em qualquer origem/],
  ])('recusa %j', (raw, message) => {
    const result = parseTrustProxy(raw);
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ message: expect.stringMatching(message) });
  });

  it('a mensagem de recusa explica os formatos válidos', () => {
    expect(parseTrustProxy('talvez')).toMatchObject({
      message: expect.stringContaining('Use false (padrão)'),
    });
  });
});
