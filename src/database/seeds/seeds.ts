import { createPrototypeExamplesSeed } from '@/database/seeds/prototype-examples.seed';
import type { Seed } from '@/database/seeds/seed';
import { SystemClock } from '@/shared/infrastructure/clock/system-clock';

const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

/**
 * Seeds registrados, na ordem de execução. O relógio é criado só na execução
 * (depois de o `typeorm.config` carregar o `.env`), no mesmo fuso `APP_TIMEZONE`
 * da API.
 */
export const SEEDS: readonly Seed[] = [
  createPrototypeExamplesSeed(
    () => new SystemClock(process.env.APP_TIMEZONE ?? DEFAULT_TIMEZONE),
  ),
];
