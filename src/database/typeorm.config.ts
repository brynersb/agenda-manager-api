import { existsSync } from 'node:fs';

import { DataSource, type DataSourceOptions } from 'typeorm';

import { SnakeNamingStrategy } from '../shared/infrastructure/persistence/snake-naming.strategy.ts';
// Import relativo com `.ts` de propósito: este arquivo também roda direto do
// TypeScript (type stripping do Node 26, via CLI de migrations), onde o alias
// `@/` não existe. O `rewriteRelativeImportExtensions` do tsconfig troca para
// `.js` no build.
import { DATABASE_LOCAL_DEFAULTS } from './database-defaults.ts';

/*
 * Configuração única do banco (ADR-004): `buildDataSourceOptions()` alimenta o
 * `DatabaseModule` do Nest e o `DataSource` exportado por padrão, que é o que a
 * CLI de migrations (`npm run migration:*`) e o seed usam. Fica autocontido
 * (sem alias `@/`, sem decorators) para o Node executá-lo direto do `.ts`.
 *
 * Três modos de execução, que mudam só onde estão as entities e as migrations:
 *  - compilado (`dist/`, JavaScript): entities pelo glob `*.entity.js` e
 *    migrations `*.js`; é o caso da API em produção, do `migration:run:prod`
 *    e do `migration:generate`;
 *  - CLI direto do TypeScript (`migration:run|revert|show`): sem entities
 *    (migration é SQL explícito e entity tem decorators, que o Node não
 *    executa) e migrations `src/database/migrations/*.ts`;
 *  - Vitest (e2e): as entities chegam pelo `autoLoadEntities` do Nest.
 */

/** Conexão já interpretada (a API entrega os valores validados pelo `ConfigService`). */
export type DatabaseSettings = {
  host: string;
  port: number;
  user: string;
  pass: string;
  name: string;
  /** `true` para Neon/produção; `false` no Postgres local. */
  ssl: boolean;
  /** Só tem efeito com `ssl: true`. */
  sslRejectUnauthorized: boolean;
  poolMax: number;
};

type PostgresOptions = Extract<DataSourceOptions, { type: 'postgres' }>;

/** `true` quando o código roda de `dist/` (JavaScript compilado). */
const compiled = typeof __filename === 'string' && __filename.endsWith('.js');
const databaseDir = typeof __dirname === 'string' ? __dirname : 'src/database';

/** Carrega o `.env` da pasta atual na CLI; não sobrescreve variável já definida. */
function loadEnvFileIfPresent(): void {
  if (existsSync('.env')) {
    process.loadEnvFile('.env');
  }
}

function parseNumber(value: string | undefined, fallback: number): number {
  return value === undefined || value === '' ? fallback : Number(value);
}

/**
 * Lê as variáveis `DATABASE_*` direto do ambiente, com os padrões locais. É o
 * caminho da CLI e do seed; a API usa as variáveis já validadas
 * (`src/config/env.validation.ts`).
 */
export function readDatabaseSettings(
  env: Record<string, string | undefined> = process.env,
): DatabaseSettings {
  return {
    host: env.DATABASE_HOST || DATABASE_LOCAL_DEFAULTS.host,
    port: parseNumber(env.DATABASE_PORT, DATABASE_LOCAL_DEFAULTS.port),
    user: env.DATABASE_USER || DATABASE_LOCAL_DEFAULTS.user,
    pass: env.DATABASE_PASS || DATABASE_LOCAL_DEFAULTS.pass,
    name: env.DATABASE_NAME || DATABASE_LOCAL_DEFAULTS.name,
    ssl: env.DATABASE_SSL === 'true',
    sslRejectUnauthorized: env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
    poolMax: parseNumber(
      env.DATABASE_POOL_MAX,
      DATABASE_LOCAL_DEFAULTS.poolMax,
    ),
  };
}

export function buildDataSourceOptions(
  settings: DatabaseSettings = readDatabaseSettings(),
): PostgresOptions {
  return {
    type: 'postgres',
    host: settings.host,
    port: settings.port,
    username: settings.user,
    password: settings.pass,
    database: settings.name,
    ssl: settings.ssl
      ? { rejectUnauthorized: settings.sslRejectUnauthorized }
      : false,
    extra: { max: settings.poolMax },
    entities: compiled ? [`${databaseDir}/../**/*.entity.js`] : [],
    migrations: [`${databaseDir}/migrations/*.${compiled ? 'js' : 'ts'}`],
    namingStrategy: new SnakeNamingStrategy(),
    // O esquema só muda por migration rodada por comando, nunca no boot.
    synchronize: false,
    migrationsRun: false,
  };
}

loadEnvFileIfPresent();

export default new DataSource(buildDataSourceOptions());
