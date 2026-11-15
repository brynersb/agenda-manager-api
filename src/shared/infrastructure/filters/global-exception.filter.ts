import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import type { LoggerServiceInterface } from '@/shared/application/interfaces/logger.service.interface';
import { LOGGER_SERVICE } from '@/shared/application/interfaces/logger.service.interface';
import {
  DomainError,
  type DomainErrorKind,
} from '@/shared/domain/errors/domain-error';
import type { InvalidField } from '@/shared/infrastructure/http/validation.pipe';
import { toErrorLogFields } from '@/shared/utils/error-log-fields';

/** Corpo de erro único da API (ADR-008). */
export type ErrorResponseBody = {
  statusCode: number;
  code: string;
  message: string;
  fields?: InvalidField[];
};

const STATUS_BY_KIND: Record<DomainErrorKind, number> = {
  NOT_FOUND: HttpStatus.NOT_FOUND,
  VALIDATION: HttpStatus.BAD_REQUEST,
  CONFLICT: HttpStatus.CONFLICT,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  UNAUTHORIZED: HttpStatus.UNAUTHORIZED,
};

const INTERNAL_ERROR: Omit<ErrorResponseBody, 'statusCode'> = {
  code: 'INTERNAL_ERROR',
  message: 'Erro interno. Tente novamente em instantes.',
};

/** `code` e mensagem derivados do status de uma `HttpException` do Nest. */
function deriveFromStatus(
  status: number,
): Omit<ErrorResponseBody, 'statusCode'> {
  switch (status) {
    case HttpStatus.UNAUTHORIZED:
      return { code: 'UNAUTHENTICATED', message: 'Autenticação necessária' };
    case HttpStatus.FORBIDDEN:
      return {
        code: 'FORBIDDEN',
        message: 'Você não tem permissão para esta operação',
      };
    case HttpStatus.NOT_FOUND:
      return { code: 'NOT_FOUND', message: 'Recurso não encontrado' };
    case HttpStatus.TOO_MANY_REQUESTS:
      return {
        code: 'TOO_MANY_REQUESTS',
        message: 'Muitas requisições. Tente novamente em instantes.',
      };
    case HttpStatus.PAYLOAD_TOO_LARGE:
      return {
        code: 'INVALID_REQUEST',
        message: 'Corpo da requisição acima do limite permitido',
      };
    default:
      return status >= HttpStatus.INTERNAL_SERVER_ERROR
        ? INTERNAL_ERROR
        : { code: 'INVALID_REQUEST', message: 'Requisição inválida' };
  }
}

/**
 * Erros de middleware do Express (ex.: corpo grande demais, JSON ilegível)
 * não são `HttpException`, mas trazem o status 4xx em `status`/`statusCode`.
 */
function middlewareErrorStatus(exception: unknown): number | undefined {
  if (typeof exception !== 'object' || exception === null) {
    return undefined;
  }
  const { status, statusCode } = exception as {
    status?: unknown;
    statusCode?: unknown;
  };
  const candidate = typeof status === 'number' ? status : statusCode;
  return typeof candidate === 'number' && candidate >= 400 && candidate < 500
    ? candidate
    : undefined;
}

function isTerminusBody(body: unknown): body is Record<string, unknown> {
  return (
    typeof body === 'object' &&
    body !== null &&
    'status' in body &&
    'details' in body
  );
}

/**
 * Único ponto que traduz exceção em resposta HTTP. `DomainError` vira status
 * pelo `kind`; `HttpException` do Nest mantém o status e ganha `code`; qualquer
 * outra coisa é 500 com mensagem genérica (o detalhe fica só no log).
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    @Inject(LOGGER_SERVICE)
    private readonly logger: LoggerServiceInterface,
  ) {
    this.logger.setLogPrefix(GlobalExceptionFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();

    if (exception instanceof DomainError) {
      const statusCode = STATUS_BY_KIND[exception.kind];
      this.logClientError(statusCode, exception, request, exception.code);
      response.status(statusCode).json({
        statusCode,
        code: exception.code,
        message: exception.message,
      } satisfies ErrorResponseBody);
      return;
    }

    if (exception instanceof HttpException) {
      this.replyHttpException(exception, response, request);
      return;
    }

    const middlewareStatus = middlewareErrorStatus(exception);
    if (middlewareStatus !== undefined && exception instanceof Error) {
      const derived = deriveFromStatus(middlewareStatus);
      this.logClientError(middlewareStatus, exception, request, derived.code);
      response.status(middlewareStatus).json({
        statusCode: middlewareStatus,
        ...derived,
      } satisfies ErrorResponseBody);
      return;
    }

    this.logServerError(HttpStatus.INTERNAL_SERVER_ERROR, exception, request);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      ...INTERNAL_ERROR,
    } satisfies ErrorResponseBody);
  }

  private replyHttpException(
    exception: HttpException,
    response: Response,
    request: Request,
  ): void {
    const statusCode = exception.getStatus();
    const body = exception.getResponse();

    // O terminus responde 503 com o detalhe de cada indicador; vale manter.
    if (statusCode >= 500 && isTerminusBody(body)) {
      this.logServerError(statusCode, exception, request);
      response.status(statusCode).json(body);
      return;
    }

    const derived = deriveFromStatus(statusCode);
    const fields =
      typeof body === 'object' && body !== null && 'fields' in body
        ? (body.fields as InvalidField[])
        : undefined;
    const code =
      typeof body === 'object' &&
      body !== null &&
      'code' in body &&
      typeof body.code === 'string'
        ? body.code
        : derived.code;

    if (statusCode >= 500) {
      this.logServerError(statusCode, exception, request);
    } else {
      this.logClientError(statusCode, exception, request, code);
    }

    response.status(statusCode).json({
      statusCode,
      code,
      message: derived.message,
      ...(fields ? { fields } : {}),
    } satisfies ErrorResponseBody);
  }

  private logClientError(
    statusCode: number,
    exception: Error,
    request: Request,
    code: string,
  ): void {
    this.logger.warn('Requisição recusada por erro do cliente', {
      'evt.name': 'http.request.client_error',
      outcome: 'failure',
      http_status_code: statusCode,
      'http.method': request.method,
      'http.path': pathOf(request),
      'error.code': code,
      ...toErrorLogFields(exception),
      tags: ['http', 'client_error'],
    });
  }

  private logServerError(
    statusCode: number,
    exception: unknown,
    request: Request,
  ): void {
    this.logger.error('Erro inesperado ao processar a requisição', {
      'evt.name': 'http.request.server_error',
      outcome: 'failure',
      http_status_code: statusCode,
      'http.method': request.method,
      'http.path': pathOf(request),
      ...toErrorLogFields(exception),
      'error.stack': exception instanceof Error ? exception.stack : undefined,
      tags: ['http', 'server_error'],
    });
  }
}

/** Caminho sem query string: a busca livre (`q`) não deve ir para o log. */
function pathOf(request: Request): string {
  return (request.originalUrl ?? request.url ?? '').split('?')[0];
}
