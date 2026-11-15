import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import {
  WINSTON_MODULE_NEST_PROVIDER,
  WINSTON_MODULE_PROVIDER,
} from 'nest-winston';
import type { Logger as WinstonLogger } from 'winston';

import { AppModule } from '@/app.module';
import { configureApp } from '@/app.setup';
import type { Env } from '@/config/env.validation';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
  configureApp(app);

  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const port = config.get('PORT', { infer: true });
  await app.listen(port);

  app.get<WinstonLogger>(WINSTON_MODULE_PROVIDER).info('API iniciada', {
    'evt.name': 'app.started',
    outcome: 'success',
    port,
    stage: config.get('STAGE', { infer: true }),
    swagger: config.get('SWAGGER_ENABLED', { infer: true }),
    tags: ['app', 'lifecycle'],
  });
}

void bootstrap();
