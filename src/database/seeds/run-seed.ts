import { Stage } from '@/config/env.validation';
import { SEEDS } from '@/database/seeds/seeds';
import dataSource from '@/database/typeorm.config';

/**
 * Executa os seeds registrados. Recusa rodar com `STAGE=e2e`: os testes
 * controlam os próprios dados.
 */
async function main(): Promise<void> {
  if (process.env.STAGE === Stage.E2e) {
    throw new Error(
      'seed:dev não roda com STAGE=e2e: os testes e2e controlam os próprios dados.',
    );
  }

  await dataSource.initialize();
  try {
    for (const seed of SEEDS) {
      await seed.execute(dataSource);
      console.info(`[seed] ${seed.name}: ok`);
    }
    console.info(`[seed] ${SEEDS.length} seed(s) executado(s).`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(
    `[seed] falhou: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
