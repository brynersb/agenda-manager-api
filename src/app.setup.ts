import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';

import type { Env } from '@/config/env.validation';
import {
  buildCorsOptions,
  parseCorsOrigins,
} from '@/shared/infrastructure/http/cors.config';
import { setupSwagger } from '@/shared/infrastructure/http/swagger.setup';

/** Limite do corpo JSON (plan §7). */
const BODY_LIMIT = '100kb';

/**
 * Configuração HTTP do app, compartilhada por `main.ts` e pelo bootstrap do
 * e2e para que os testes exercitem exatamente o que roda em produção.
 * Pipe, filtro, guards e middlewares ficam no `AppModule` (providers globais).
 */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  // A API roda em http local; `upgrade-insecure-requests` quebraria o Swagger UI
  // em navegadores que o aplicam também a localhost.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: { 'upgrade-insecure-requests': null },
      },
    }),
  );
  app.enableCors(
    buildCorsOptions(
      parseCorsOrigins(config.get('CORS_ORIGINS', { infer: true })),
    ),
  );
  app.useBodyParser('json', { limit: BODY_LIMIT });

  app.setGlobalPrefix('api', { exclude: ['health'] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableShutdownHooks();

  if (config.get('SWAGGER_ENABLED', { infer: true })) {
    setupSwagger(app);
  }
}
