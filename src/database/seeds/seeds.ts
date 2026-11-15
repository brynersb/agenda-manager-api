import { createDevUsersSeed } from '@/database/seeds/dev-users.seed';
import { createPrototypeExamplesSeed } from '@/database/seeds/prototype-examples.seed';
import type { Seed } from '@/database/seeds/seed';
import { SystemClock } from '@/shared/infrastructure/clock/system-clock';
import { Argon2PasswordHasher } from '@/shared/infrastructure/security/argon2-password-hasher';

const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

const getClock = () =>
  new SystemClock(process.env.APP_TIMEZONE ?? DEFAULT_TIMEZONE);

/**
 * Seeds registrados, na ordem de execução. O relógio é criado só na execução
 * (depois de o `typeorm.config` carregar o `.env`), no mesmo fuso `APP_TIMEZONE`
 * da API.
 */
export const SEEDS: readonly Seed[] = [
  createDevUsersSeed(getClock, () => new Argon2PasswordHasher()),
  createPrototypeExamplesSeed(getClock),
];
