import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import { format, transports } from 'winston';

import type { Env } from '@/config/env.validation';
import { Stage } from '@/config/env.validation';
import { LOGGER_SERVICE } from '@/shared/application/interfaces/logger.service.interface';
import { requestContext } from '@/shared/infrastructure/http/request-context';
import { LoggerService } from '@/shared/infrastructure/logger/logger.service';

/** Anexa `request_id` a todo log emitido dentro de uma requisição. */
const attachRequestId = format((info) => {
  const requestId = requestContext.getStore()?.requestId;
  if (requestId) {
    info.request_id = requestId;
  }
  return info;
});

/** Formato legível para `local`: hora, nível, contexto, mensagem e metadados. */
const localFormat = format.combine(
  attachRequestId(),
  format.timestamp({ format: 'HH:mm:ss' }),
  format.colorize(),
  format.printf(
    ({ timestamp, level, message, context, request_id, ...remaining }) => {
      const ctx = context ? ` [${String(context)}]` : '';
      const rid = request_id ? ` (${String(request_id).slice(0, 8)})` : '';
      const extras = Object.keys(remaining).length
        ? ` ${JSON.stringify(remaining)}`
        : '';
      return `${timestamp} ${level}${ctx}${rid} ${message}${extras}`;
    },
  ),
);

/** JSON de uma linha por evento, para coleta fora de `local`. */
const jsonFormat = format.combine(
  attachRequestId(),
  format.timestamp(),
  format.errors({ stack: true }),
  format.json(),
);

@Global()
@Module({
  imports: [
    WinstonModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        level: config.get('LOG_LEVEL', { infer: true }),
        format:
          config.get('STAGE', { infer: true }) === Stage.Local
            ? localFormat
            : jsonFormat,
        transports: [new transports.Console()],
      }),
    }),
  ],
  providers: [{ provide: LOGGER_SERVICE, useClass: LoggerService }],
  exports: [LOGGER_SERVICE, WinstonModule],
})
export class LoggerModule {}
