import { Stage } from '@/config/env.validation';
import { SEEDS } from '@/database/seeds/seeds';
import dataSource from '@/database/typeorm.config';

/** Únicos ambientes em que o seed de desenvolvimento pode rodar. */
const SEEDABLE_STAGES: readonly string[] = [Stage.Local, Stage.Demo];

/**
 * Executa os seeds registrados (inclusive os usuários `dev.*@pauta.local` com
 * senha de desenvolvimento). Só roda com `STAGE=local` ou `STAGE=demo` (sem
 * `STAGE`, vale `local`, o padrão da API): recusa produção e `e2e` (os testes
 * controlam os próprios dados).
 */
async function main(): Promise<void> {
  const stage = process.env.STAGE || Stage.Local;
  if (!SEEDABLE_STAGES.includes(stage)) {
    throw new Error(
      `seed:dev só roda com STAGE=local ou STAGE=demo (STAGE atual: ${stage}): ele cria usuários com senha de desenvolvimento.`,
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
