import { resolve } from 'node:path';

import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import type { TestProject } from 'vitest/node';

/** Conexão do Postgres do e2e, nas mesmas variáveis separadas da API. */
export type E2eDatabase = {
  host: string;
  port: number;
  user: string;
  pass: string;
  name: string;
};

declare module 'vitest' {
  export interface ProvidedContext {
    /** Postgres do e2e, com as migrations já aplicadas. */
    e2eDatabase: E2eDatabase;
  }
}

const POSTGRES_IMAGE = 'postgres:18-alpine';

/** Aplica as migrations pendentes, como `npm run migration:run` faria. */
async function runMigrations(database: E2eDatabase): Promise<void> {
  const dataSource = new DataSource({
    type: 'postgres',
    host: database.host,
    port: database.port,
    username: database.user,
    password: database.pass,
    database: database.name,
    migrations: [resolve(process.cwd(), 'src/database/migrations/*.ts')],
  });
  await dataSource.initialize();
  try {
    await dataSource.runMigrations();
  } finally {
    await dataSource.destroy();
  }
}

/**
 * Banco externo informado por `E2E_DATABASE_HOST`, `E2E_DATABASE_PORT`,
 * `E2E_DATABASE_USER`, `E2E_DATABASE_PASS` e `E2E_DATABASE_NAME`; `undefined`
 * quando `E2E_DATABASE_HOST` não existe.
 */
function externalDatabase(): E2eDatabase | undefined {
  const host = process.env.E2E_DATABASE_HOST;
  if (!host) {
    return undefined;
  }
  return {
    host,
    port: Number(process.env.E2E_DATABASE_PORT ?? 5432),
    user: process.env.E2E_DATABASE_USER ?? 'pauta',
    pass: process.env.E2E_DATABASE_PASS ?? 'pauta',
    name: process.env.E2E_DATABASE_NAME ?? 'pauta',
  };
}

/**
 * Prepara o Postgres do e2e (ADR-009). Com `E2E_DATABASE_HOST` (e as demais
 * `E2E_DATABASE_*`) usa esse banco (atenção: os specs truncam as tabelas de
 * negócio dele); sem ela sobe um contêiner efêmero via Testcontainers.
 */
export default async function setup(
  project: TestProject,
): Promise<() => Promise<void>> {
  const external = externalDatabase();

  if (external) {
    await runMigrations(external);
    project.provide('e2eDatabase', external);
    console.info('[e2e] Postgres externo (E2E_DATABASE_*).');
    return async () => {};
  }

  const container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
  const database: E2eDatabase = {
    host: container.getHost(),
    port: container.getPort(),
    user: container.getUsername(),
    pass: container.getPassword(),
    name: container.getDatabase(),
  };
  await runMigrations(database);
  project.provide('e2eDatabase', database);
  console.info(
    `[e2e] Postgres efêmero (${POSTGRES_IMAGE}) via Testcontainers.`,
  );

  return async () => {
    await container.stop();
  };
}
