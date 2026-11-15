import { LogLevel, NodeEnv, Stage, validate } from '@/config/env.validation';

const DATABASE = {
  DATABASE_HOST: 'db',
  DATABASE_PORT: '5432',
  DATABASE_USER: 'u',
  DATABASE_PASS: 'p',
  DATABASE_NAME: 'pauta',
  DATABASE_SSL: 'false',
};
const OIDC = {
  OIDC_ISSUER_URL: 'http://localhost:8080/realms/bora',
  OIDC_AUDIENCE: 'pauta-mkt-api',
};

/** `validate` com a configuração OIDC mínima, para os testes alheios à auth. */
function validateConfig(config: Record<string, unknown>) {
  return validate({ ...OIDC, ...config });
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
  describe('autenticação', () => {
    const DEMO_BASE = {
      STAGE: 'demo',
      CORS_ORIGINS: 'http://localhost:8081',
      ...DATABASE,
    };

    it('aplica os padrões de OIDC_ROLES_CLAIM, AUTH_MOCK_ENABLED e AUTH_MOCK_ROLE', () => {
      const env = validateConfig({});

      expect(env).toMatchObject({
        OIDC_ISSUER_URL: 'http://localhost:8080/realms/bora',
        OIDC_AUDIENCE: 'pauta-mkt-api',
        OIDC_ROLES_CLAIM: 'realm_access.roles',
        AUTH_MOCK_ENABLED: false,
        AUTH_MOCK_ROLE: 'content-brief-editor',
      });
    });

    it('recusa subir em local sem OIDC_ISSUER_URL e sem mock', () => {
      expect(() => validate({})).toThrow(/OIDC_ISSUER_URL/);
      expect(() => validate({ OIDC_ISSUER_URL: OIDC.OIDC_ISSUER_URL })).toThrow(
        /OIDC_AUDIENCE/,
      );
    });

    it('dispensa OIDC em local com AUTH_MOCK_ENABLED=true', () => {
      const env = validate({ AUTH_MOCK_ENABLED: 'true' });

      expect(env.AUTH_MOCK_ENABLED).toBe(true);
    });

    it('dispensa OIDC em e2e', () => {
      expect(() => validate({ STAGE: 'e2e', ...DATABASE })).not.toThrow();
    });

    it('STAGE=demo sem OIDC_ISSUER_URL impede o boot', () => {
      expect(() =>
        validate({ ...DEMO_BASE, OIDC_AUDIENCE: 'pauta-mkt-api' }),
      ).toThrow(/OIDC_ISSUER_URL/);
    });

    it('STAGE=demo sem OIDC_AUDIENCE impede o boot', () => {
      expect(() =>
        validate({ ...DEMO_BASE, OIDC_ISSUER_URL: OIDC.OIDC_ISSUER_URL }),
      ).toThrow(/OIDC_AUDIENCE/);
    });

    it('STAGE=demo com AUTH_MOCK_ENABLED=true impede o boot, mesmo com OIDC', () => {
      expect(() =>
        validate({ ...DEMO_BASE, ...OIDC, AUTH_MOCK_ENABLED: 'true' }),
      ).toThrow(/AUTH_MOCK_ENABLED/);
    });

    it('STAGE=e2e com AUTH_MOCK_ENABLED=true impede o boot', () => {
      expect(() =>
        validate({
          STAGE: 'e2e',
          ...DATABASE,
          AUTH_MOCK_ENABLED: 'true',
        }),
      ).toThrow(/AUTH_MOCK_ENABLED/);
    });

    it('STAGE=demo com OIDC completo e mock desligado sobe', () => {
      const env = validate({
        ...DEMO_BASE,
        ...OIDC,
        AUTH_MOCK_ENABLED: 'false',
      });

      expect(env.AUTH_MOCK_ENABLED).toBe(false);
    });

    it('recusa OIDC_ISSUER_URL que não é http(s) e AUTH_MOCK_ROLE desconhecido', () => {
      expect(() => validateConfig({ OIDC_ISSUER_URL: 'keycloak' })).toThrow(
        /OIDC_ISSUER_URL/,
      );
      expect(() => validateConfig({ AUTH_MOCK_ROLE: 'admin' })).toThrow(
        /AUTH_MOCK_ROLE/,
      );
    });

    it('aceita OIDC_JWKS_URI e papel de mock leitor', () => {
      const env = validateConfig({
        OIDC_JWKS_URI:
          'http://keycloak:8080/realms/bora/protocol/openid-connect/certs',
        AUTH_MOCK_ROLE: 'content-brief-viewer',
      });

      expect(env.AUTH_MOCK_ROLE).toBe('content-brief-viewer');
      expect(() => validateConfig({ OIDC_JWKS_URI: 'ftp://x' })).toThrow(
        /OIDC_JWKS_URI/,
      );
    });
  });
});
