import { randomUUID } from 'node:crypto';

import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { requestContext } from '@/shared/infrastructure/http/request-context';

export const REQUEST_ID_HEADER = 'x-request-id';

/** Aceita só ids curtos e sem caracteres de controle (evita injeção em log/header). */
const VALID_REQUEST_ID = /^[\w.:-]{1,128}$/;

/**
 * Garante um `x-request-id` por requisição: reaproveita o que chegou (se for
 * válido) ou gera um uuid, devolve no header da resposta e abre o contexto
 * assíncrono lido pelo logger.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const received = req.header(REQUEST_ID_HEADER);
    const requestId =
      received && VALID_REQUEST_ID.test(received) ? received : randomUUID();

    res.setHeader(REQUEST_ID_HEADER, requestId);
    requestContext.run({ requestId }, () => next());
  }
}
