import { Inject, Injectable, Scope } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger as WinstonLogger } from 'winston';

import type { LoggerServiceInterface } from '@/shared/application/interfaces/logger.service.interface';

/**
 * Implementação Winston da porta de log. É `TRANSIENT` porque cada consumidor
 * guarda o próprio prefixo (`setLogPrefix`); o `request_id` é anexado pelo
 * formato do Winston (ver `logger.module.ts`).
 */
@Injectable({ scope: Scope.TRANSIENT })
export class LoggerService implements LoggerServiceInterface {
  private logPrefix?: string;

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: WinstonLogger,
  ) {}

  setLogPrefix(logPrefix: string): void {
    this.logPrefix = logPrefix;
  }

  log(message: string, metadata?: unknown): void {
    this.logger.info(this.buildMessage(message), metadata);
  }

  info(message: string, metadata?: unknown): void {
    this.logger.info(this.buildMessage(message), metadata);
  }

  warn(message: string, metadata?: unknown): void {
    this.logger.warn(this.buildMessage(message), metadata);
  }

  error(message: string, metadata?: unknown): void {
    this.logger.error(this.buildMessage(message), metadata);
  }

  debug(message: string, metadata?: unknown): void {
    this.logger.debug(this.buildMessage(message), metadata);
  }

  private buildMessage(message: string): string {
    return this.logPrefix ? `[${this.logPrefix}] ${message}` : message;
  }
}
