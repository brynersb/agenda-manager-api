import type { DataSource } from 'typeorm';

/** Um seed de desenvolvimento. Precisa ser idempotente: rodar 2x não duplica. */
export type Seed = {
  name: string;
  execute(dataSource: DataSource): Promise<void>;
};
