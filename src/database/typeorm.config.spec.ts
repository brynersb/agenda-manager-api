import { validate } from '@/config/env.validation';
import {
  buildDataSourceOptions,
  readDatabaseSettings,
} from '@/database/typeorm.config';

describe('typeorm.config', () => {
  describe('readDatabaseSettings', () => {
    it('usa os padrões locais quando o ambiente está vazio', () => {
      expect(readDatabaseSettings({})).toEqual({
        host: 'localhost',
        port: 5433,
        user: 'pauta',
        pass: 'pauta',
        name: 'pauta',
        ssl: false,
        sslRejectUnauthorized: true,
        poolMax: 10,
      });
    });

    it('lê as variáveis DATABASE_* separadas', () => {
      expect(
        readDatabaseSettings({
          DATABASE_HOST: 'ep-x.neon.tech',
          DATABASE_PORT: '5432',
          DATABASE_USER: 'u',
          DATABASE_PASS: 'p',
          DATABASE_NAME: 'bora',
          DATABASE_SSL: 'true',
          DATABASE_SSL_REJECT_UNAUTHORIZED: 'false',
          DATABASE_POOL_MAX: '4',
        }),
      ).toEqual({
        host: 'ep-x.neon.tech',
        port: 5432,
        user: 'u',
        pass: 'p',
        name: 'bora',
        ssl: true,
        sslRejectUnauthorized: false,
        poolMax: 4,
      });
    });

    it('concorda com os padrões que a validação aplica em STAGE=local', () => {
      const env = validate({ AUTH_MOCK_ENABLED: 'true' });
      const settings = readDatabaseSettings({});

      expect(settings).toMatchObject({
        host: env.DATABASE_HOST,
        port: env.DATABASE_PORT,
        user: env.DATABASE_USER,
        pass: env.DATABASE_PASS,
        name: env.DATABASE_NAME,
        ssl: env.DATABASE_SSL,
        sslRejectUnauthorized: env.DATABASE_SSL_REJECT_UNAUTHORIZED,
        poolMax: env.DATABASE_POOL_MAX,
      });
    });
  });

  describe('buildDataSourceOptions', () => {
    const settings = readDatabaseSettings({});

    it('monta a conexão Postgres a partir das variáveis separadas', () => {
      expect(buildDataSourceOptions(settings)).toMatchObject({
        type: 'postgres',
        host: 'localhost',
        port: 5433,
        username: 'pauta',
        password: 'pauta',
        database: 'pauta',
        ssl: false,
        extra: { max: 10 },
        synchronize: false,
        migrationsRun: false,
      });
    });

    it('liga o TLS só com ssl=true, respeitando a validação do certificado', () => {
      expect(buildDataSourceOptions({ ...settings, ssl: true }).ssl).toEqual({
        rejectUnauthorized: true,
      });
      expect(
        buildDataSourceOptions({
          ...settings,
          ssl: true,
          sslRejectUnauthorized: false,
        }).ssl,
      ).toEqual({ rejectUnauthorized: false });
    });

    it('aponta as migrations para src/database/migrations', () => {
      expect(buildDataSourceOptions(settings).migrations).toEqual([
        expect.stringMatching(/database\/migrations\/\*\.ts$/),
      ]);
    });
  });
});
