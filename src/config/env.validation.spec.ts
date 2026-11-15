import {
  DEV_JWT_SECRET,
  LogLevel,
  NodeEnv,
  Stage,
  validate,
} from '@/config/env.validation';

const DATABASE = {
  DATABASE_HOST: 'db',
  DATABASE_PORT: '5432',
  DATABASE_USER: 'u',
  DATABASE_PASS: 'p',
  DATABASE_NAME: 'pauta',
  DATABASE_SSL: 'false',
};
/** Segredo de teste (placeholder de 40 caracteres), exigido fora de local/e2e. */
const JWT_SECRET = 'segredo-de-teste-com-mais-de-32-caracteres';

/** `validate` com o segredo JWT, para os testes alheios à auth (STAGE=demo o exige). */
function validateConfig(config: Record<string, unknown>) {
  return validate({ JWT_SECRET, ...config });
}

describe('validate (variáveis de ambiente)', () => {
  it('aplica os padrões quando nada é informado', () => {
    const env = validateConfig({});

    expect(env).toMatchObject({
      NODE_ENV: NodeEnv.Development,
      STAGE: Stage.Local,
      PORT: 3000,
      APP_TIMEZONE: 'America/Sao_Paulo',
      CORS_ORIGINS: 'http://localhost:5173',
      LOG_LEVEL: LogLevel.Info,
      THROTTLE_LIMIT_PER_MINUTE: 300,
      SWAGGER_ENABLED: true,
      DATABASE_HOST: 'localhost',
      DATABASE_PORT: 5433,
      DATABASE_USER: 'pauta',
      DATABASE_PASS: 'pauta',
      DATABASE_NAME: 'pauta',
      DATABASE_SSL: false,
      DATABASE_SSL_REJECT_UNAUTHORIZED: true,
      DATABASE_POOL_MAX: 10,
    });
  });

  it('converte números vindos como string', () => {
    const env = validateConfig({
      PORT: '4000',
      THROTTLE_LIMIT_PER_MINUTE: '10',
    });

    expect(env.PORT).toBe(4000);
    expect(env.THROTTLE_LIMIT_PER_MINUTE).toBe(10);
  });

  it.each([
    ['false', false],
    ['true', true],
    [false, false],
  ])('interpreta SWAGGER_ENABLED=%s como %s', (value, expected) => {
    expect(validateConfig({ SWAGGER_ENABLED: value }).SWAGGER_ENABLED).toBe(
      expected,
    );
  });

  it('recusa APP_TIMEZONE fora da lista IANA', () => {
    expect(() => validateConfig({ APP_TIMEZONE: 'Marte/Base' })).toThrow(
      /APP_TIMEZONE/,
    );
  });

  it('aceita APP_TIMEZONE IANA e UTC', () => {
    expect(
      validateConfig({ APP_TIMEZONE: 'America/Manaus' }).APP_TIMEZONE,
    ).toBe('America/Manaus');
    expect(validateConfig({ APP_TIMEZONE: 'UTC' }).APP_TIMEZONE).toBe('UTC');
  });

  it('exige CORS_ORIGINS quando STAGE=demo', () => {
    expect(() => validateConfig({ STAGE: 'demo' })).toThrow(/CORS_ORIGINS/);
  });

  it('aceita STAGE=demo com CORS_ORIGINS informado', () => {
    const env = validateConfig({
      STAGE: 'demo',
      CORS_ORIGINS: 'http://localhost:8081',
      ...DATABASE,
    });

    expect(env.CORS_ORIGINS).toBe('http://localhost:8081');
  });

  it('usa o CORS padrão em e2e', () => {
    expect(validateConfig({ STAGE: 'e2e', ...DATABASE }).CORS_ORIGINS).toBe(
      'http://localhost:5173',
    );
  });

  it.each([
    { STAGE: 'producao' },
    { LOG_LEVEL: 'verbose' },
    { PORT: '0' },
    { NODE_ENV: 'staging' },
  ])('recusa valor inválido %o', (config) => {
    expect(() => validateConfig(config)).toThrow(
      /Configuração de ambiente inválida/,
    );
  });

  describe('banco de dados', () => {
    it.each(['demo', 'e2e'])(
      'exige as variáveis DATABASE_* quando STAGE=%s',
      (stage) => {
        expect(() =>
          validateConfig({
            STAGE: stage,
            CORS_ORIGINS: 'http://localhost:8081',
          }),
        ).toThrow(
          /DATABASE_HOST é obrigatória.*DATABASE_PORT.*DATABASE_USER é obrigatória.*DATABASE_PASS é obrigatória.*DATABASE_NAME é obrigatória.*DATABASE_SSL deve ser true ou false/s,
        );
      },
    );

    it.each([
      'DATABASE_HOST',
      'DATABASE_PORT',
      'DATABASE_USER',
      'DATABASE_PASS',
      'DATABASE_NAME',
      'DATABASE_SSL',
    ])('fora de local, a falta de só %s impede o boot', (name) => {
      const { [name]: _removed, ...incomplete } = DATABASE as Record<
        string,
        string
      >;

      expect(() =>
        validateConfig({
          STAGE: 'e2e',
          ...incomplete,
        }),
      ).toThrow(new RegExp(`${name}`));
    });

    it('aceita as variáveis DATABASE_* completas fora de local', () => {
      const env = validateConfig({ STAGE: 'e2e', ...DATABASE });

      expect(env).toMatchObject({
        DATABASE_HOST: 'db',
        DATABASE_PORT: 5432,
        DATABASE_USER: 'u',
        DATABASE_PASS: 'p',
        DATABASE_NAME: 'pauta',
        DATABASE_SSL: false,
      });
    });

    it('mantém as variáveis DATABASE_* informadas em local', () => {
      const env = validateConfig({ ...DATABASE, DATABASE_SSL: 'true' });

      expect(env).toMatchObject({
        DATABASE_HOST: 'db',
        DATABASE_PORT: 5432,
        DATABASE_SSL: true,
      });
    });

    it.each(['0', '65536', 'abc', '54.3'])(
      'recusa DATABASE_PORT inválida (%s)',
      (port) => {
        expect(() => validateConfig({ DATABASE_PORT: port })).toThrow(
          /DATABASE_PORT deve ser um número inteiro entre 1 e 65535/,
        );
      },
    );

    it('recusa DATABASE_SSL que não é true nem false', () => {
      expect(() => validateConfig({ DATABASE_SSL: 'sim' })).toThrow(
        /DATABASE_SSL deve ser true ou false/,
      );
    });

    it('trata variável DATABASE_* vazia como ausente em local', () => {
      const env = validateConfig({ DATABASE_HOST: '', DATABASE_PORT: '' });

      expect(env.DATABASE_HOST).toBe('localhost');
      expect(env.DATABASE_PORT).toBe(5433);
    });

    it.each([
      ['false', false],
      ['true', true],
    ])('interpreta DATABASE_SSL=%s como %s', (value, expected) => {
      expect(validateConfig({ DATABASE_SSL: value }).DATABASE_SSL).toBe(
        expected,
      );
    });

    it('usa false como padrão de DATABASE_SSL em local', () => {
      expect(validateConfig({}).DATABASE_SSL).toBe(false);
    });

    it('interpreta DATABASE_SSL_REJECT_UNAUTHORIZED=false (padrão true)', () => {
      expect(
        validateConfig({ DATABASE_SSL_REJECT_UNAUTHORIZED: 'false' })
          .DATABASE_SSL_REJECT_UNAUTHORIZED,
      ).toBe(false);
      expect(validateConfig({}).DATABASE_SSL_REJECT_UNAUTHORIZED).toBe(true);
    });

    it('converte DATABASE_POOL_MAX e recusa valor menor que 1', () => {
      expect(
        validateConfig({ DATABASE_POOL_MAX: '25' }).DATABASE_POOL_MAX,
      ).toBe(25);
      expect(() => validateConfig({ DATABASE_POOL_MAX: '0' })).toThrow(
        /DATABASE_POOL_MAX/,
      );
    });
  });
  describe('autenticação própria', () => {
    const DEMO_BASE = {
      STAGE: 'demo',
      CORS_ORIGINS: 'http://localhost:8081',
      ...DATABASE,
    };

    it('aplica os padrões de JWT, bloqueio de login e throttle', () => {
      const env = validate({});

      expect(env).toMatchObject({
        JWT_SECRET: DEV_JWT_SECRET,
        JWT_ISSUER: 'pauta-mkt-api',
        JWT_AUDIENCE: 'pauta-mkt',
        JWT_ACCESS_TTL: '15m',
        JWT_REFRESH_TTL: '7d',
        LOGIN_MAX_ATTEMPTS: 5,
        LOGIN_LOCK_MINUTES: 15,
        LOGIN_THROTTLE_LIMIT_PER_MINUTE: 10,
      });
      expect(env.BOOTSTRAP_ADMIN_EMAIL).toBeUndefined();
      expect(env.BOOTSTRAP_ADMIN_PASSWORD).toBeUndefined();
    });

    it('o segredo de desenvolvimento só vale em local e e2e', () => {
      expect(validate({ STAGE: 'local' }).JWT_SECRET).toBe(DEV_JWT_SECRET);
      expect(validate({ STAGE: 'e2e', ...DATABASE }).JWT_SECRET).toBe(
        DEV_JWT_SECRET,
      );
    });

    it('STAGE=demo sem JWT_SECRET impede o boot', () => {
      expect(() => validate(DEMO_BASE)).toThrow(/JWT_SECRET/);
      expect(() => validate({ ...DEMO_BASE, JWT_SECRET: '' })).toThrow(
        /JWT_SECRET/,
      );
    });

    it('recusa o segredo de desenvolvimento declarado explicitamente fora de local/e2e', () => {
      expect(() =>
        validate({ ...DEMO_BASE, JWT_SECRET: DEV_JWT_SECRET }),
      ).toThrow(/segredo de desenvolvimento/);
    });

    it('recusa JWT_SECRET com menos de 32 caracteres em qualquer STAGE', () => {
      expect(() => validate({ JWT_SECRET: 'curto' })).toThrow(/JWT_SECRET/);
      expect(() =>
        validate({ ...DEMO_BASE, JWT_SECRET: 'x'.repeat(31) }),
      ).toThrow(/JWT_SECRET/);
    });

    it('STAGE=demo com JWT_SECRET de 32+ caracteres sobe', () => {
      const env = validate({ ...DEMO_BASE, JWT_SECRET });

      expect(env.JWT_SECRET).toBe(JWT_SECRET);
    });

    it('aceita TTLs, limites e iss/aud informados', () => {
      const env = validateConfig({
        JWT_ISSUER: 'outro-iss',
        JWT_AUDIENCE: 'outra-aud',
        JWT_ACCESS_TTL: '30m',
        JWT_REFRESH_TTL: '14d',
        LOGIN_MAX_ATTEMPTS: '3',
        LOGIN_LOCK_MINUTES: '30',
        LOGIN_THROTTLE_LIMIT_PER_MINUTE: '5',
      });

      expect(env).toMatchObject({
        JWT_ISSUER: 'outro-iss',
        JWT_AUDIENCE: 'outra-aud',
        JWT_ACCESS_TTL: '30m',
        JWT_REFRESH_TTL: '14d',
        LOGIN_MAX_ATTEMPTS: 3,
        LOGIN_LOCK_MINUTES: 30,
        LOGIN_THROTTLE_LIMIT_PER_MINUTE: 5,
      });
    });

    it.each([
      { JWT_ACCESS_TTL: '15' },
      { JWT_ACCESS_TTL: '0m' },
      { JWT_REFRESH_TTL: '7 dias' },
      { LOGIN_MAX_ATTEMPTS: '0' },
      { LOGIN_LOCK_MINUTES: '0' },
      { LOGIN_THROTTLE_LIMIT_PER_MINUTE: '0' },
      { JWT_ISSUER: '' },
    ])('recusa valor inválido %o', (config) => {
      expect(() => validateConfig(config)).toThrow(
        /Configuração de ambiente inválida/,
      );
    });

    it('o erro de configuração nunca ecoa o valor do segredo', () => {
      expect(() => validate({ JWT_SECRET: 'segredo-curto' })).toThrow(
        expect.objectContaining({
          message: expect.not.stringContaining('segredo-curto'),
        }),
      );
    });

    describe('administrador inicial', () => {
      it('aceita e-mail e senha válidos', () => {
        const env = validateConfig({
          BOOTSTRAP_ADMIN_EMAIL: 'admin@pauta.local',
          BOOTSTRAP_ADMIN_PASSWORD: 'troque-esta-senha-1',
        });

        expect(env.BOOTSTRAP_ADMIN_EMAIL).toBe('admin@pauta.local');
        expect(env.BOOTSTRAP_ADMIN_PASSWORD).toBe('troque-esta-senha-1');
      });

      it('trata as duas variáveis vazias como não definidas', () => {
        expect(() =>
          validateConfig({
            BOOTSTRAP_ADMIN_EMAIL: '',
            BOOTSTRAP_ADMIN_PASSWORD: '',
          }),
        ).not.toThrow();
      });

      it('valida o formato só quando definidas', () => {
        expect(() =>
          validateConfig({
            BOOTSTRAP_ADMIN_EMAIL: 'sem-arroba',
            BOOTSTRAP_ADMIN_PASSWORD: 'troque-esta-senha-1',
          }),
        ).toThrow(/BOOTSTRAP_ADMIN_EMAIL/);
        expect(() =>
          validateConfig({
            BOOTSTRAP_ADMIN_EMAIL: 'admin@pauta.local',
            BOOTSTRAP_ADMIN_PASSWORD: 'curta',
          }),
        ).toThrow(/BOOTSTRAP_ADMIN_PASSWORD/);
      });

      it('exige as duas juntas ou nenhuma', () => {
        expect(() =>
          validateConfig({ BOOTSTRAP_ADMIN_EMAIL: 'admin@pauta.local' }),
        ).toThrow(/definidos juntos/);
        expect(() =>
          validateConfig({ BOOTSTRAP_ADMIN_PASSWORD: 'troque-esta-senha-1' }),
        ).toThrow(/definidos juntos/);
      });
    });
  });
});
