import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { inject } from 'vitest';

import { configureApp } from '@/app.setup';
import { DEV_JWT_SECRET } from '@/config/env.validation';
import {
  TOKEN_SERVICE,
  type TokenServiceInterface,
} from '@/modules/auth/application/interfaces/token.service.interface';
import { Role } from '@/modules/auth/domain/enums/role';
import { CLOCK } from '@/shared/application/interfaces/clock.interface';
import {
  DEFAULT_TEST_TODAY,
  FixedClock,
} from '@/shared/infrastructure/clock/fixed-clock';
import { HttpClient } from '../core/http-client';
import { forgeAccessToken, TOKEN_USERS, TOKENS } from '../core/tokens';

export type AppE2e = {
  app: NestExpressApplication;
  baseUrl: string;
  client: HttpClient;
  dataSource: DataSource;
  /** Relógio injetado no app; `clock.setToday('YYYY-MM-DD')` muda o dia. */
  clock: FixedClock;
  close: () => Promise<void>;
};

export type BootstrapOptions = {
  /** Variáveis de ambiente que sobrepõem as padrão do e2e. */
  env?: Record<string, string>;
  /** Providers trocados por valores de teste, depois dos padrão (relógio). */
  providers?: { token: unknown; useValue: unknown }[];
  /** Dia corrente do relógio fixo (padrão `2026-11-14`). */
  today?: string;
};

/** Variáveis padrão do e2e; `env` permite testar um cenário específico. */
const ENV_E2E: Record<string, string> = {
  STAGE: 'e2e',
  LOG_LEVEL: 'error',
  THROTTLE_LIMIT_PER_MINUTE: '100000',
  // Hermético: um `.env` local não pode mudar o e2e (login, bootstrap, JWT).
  JWT_SECRET: DEV_JWT_SECRET,
  JWT_ISSUER: 'pauta-mkt-api',
  JWT_AUDIENCE: 'pauta-mkt',
  JWT_ACCESS_TTL: '15m',
  JWT_REFRESH_TTL: '7d',
  LOGIN_MAX_ATTEMPTS: '5',
  LOGIN_LOCK_MINUTES: '15',
  LOGIN_THROTTLE_LIMIT_PER_MINUTE: '100000',
  BOOTSTRAP_ADMIN_EMAIL: '',
  BOOTSTRAP_ADMIN_PASSWORD: '',
};

/**
 * Sobe o `AppModule` real, com a mesma configuração HTTP do `main.ts`, contra
 * o Postgres preparado pelo `globalSetup`, numa porta aleatória. O relógio é
 * um `FixedClock`; a autenticação é a real (JWT HS256 e argon2id). Preenche
 * `TOKENS` com access tokens emitidos pelo `TokenService` da aplicação.
 */
export async function bootstrapApp(
  options: BootstrapOptions = {},
): Promise<AppE2e> {
  const database = inject('e2eDatabase');
  Object.assign(
    process.env,
    {
      DATABASE_HOST: database.host,
      DATABASE_PORT: String(database.port),
      DATABASE_USER: database.user,
      DATABASE_PASS: database.pass,
      DATABASE_NAME: database.name,
      DATABASE_SSL: 'false',
    },
    ENV_E2E,
    options.env,
  );

  // Import tardio: o `ConfigModule.forRoot` valida o ambiente quando o
  // `AppModule` é carregado, e isso precisa acontecer com `STAGE=e2e` já em
  // `process.env` (sem ele, o padrão `local` usaria o banco local).
  const { AppModule } = await import('@/app.module.js');

  const clock = new FixedClock(options.today ?? DEFAULT_TEST_TODAY);

  let builder = Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(CLOCK)
    .useValue(clock);
  for (const { token, useValue } of options.providers ?? []) {
    builder = builder.overrideProvider(token).useValue(useValue);
  }
  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.listen(0, '127.0.0.1');

  const tokenService = app.get<TokenServiceInterface>(TOKEN_SERVICE);
  const issue = (
    user: (typeof TOKEN_USERS)[keyof typeof TOKEN_USERS],
    role: Role,
  ) => tokenService.issueAccessToken({ ...user, role }).token;
  TOKENS.admin = issue(TOKEN_USERS.admin, Role.Admin);
  TOKENS.editor = issue(TOKEN_USERS.editor, Role.Editor);
  TOKENS.viewer = issue(TOKEN_USERS.viewer, Role.Viewer);
  TOKENS.unknownRole = forgeAccessToken({ role: 'ghost' });

  const address = app.getHttpServer().address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    app,
    baseUrl,
    client: new HttpClient(baseUrl),
    dataSource: app.get(DataSource),
    clock,
    close: () => app.close(),
  };
}
