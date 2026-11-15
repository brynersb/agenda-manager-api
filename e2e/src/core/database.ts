import type { DataSource } from 'typeorm';

/** Tabela de controle do TypeORM: nunca é truncada. */
const MIGRATIONS_TABLE = 'migrations';

/**
 * Esvazia todas as tabelas de negócio (descobertas por `information_schema`,
 * então tabela nova entra sozinha) e reinicia sequences. Chamar no
 * `beforeEach` de cada spec (ADR-009).
 */
export async function cleanDatabase(dataSource: DataSource): Promise<void> {
  const tables: { table_name: string }[] = await dataSource.query(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name <> $1`,
    [MIGRATIONS_TABLE],
  );

  if (tables.length === 0) {
    return;
  }

  const list = tables
    .map(({ table_name }) => `"${table_name.replaceAll('"', '""')}"`)
    .join(', ');
  await dataSource.query(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}
