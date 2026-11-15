import {
  type ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';

import type { LoggerServiceInterface } from '@/shared/application/interfaces/logger.service.interface';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@/shared/domain/errors/domain-error';
import { GlobalExceptionFilter } from '@/shared/infrastructure/filters/global-exception.filter';

function create() {
  const logger: LoggerServiceInterface = {
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    setLogPrefix: vi.fn(),
  };
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({
        method: 'GET',
        originalUrl: '/api/v1/content-briefs?q=segredo',
      }),
    }),
  } as unknown as ArgumentsHost;

  const filter = new GlobalExceptionFilter(logger);
  return {
    logger,
    status,
    json,
    capture: (error: unknown) => filter.catch(error, host),
  };
}

describe('GlobalExceptionFilter', () => {
  it.each([
    [new NotFoundError('CONTENT_BRIEF_NOT_FOUND', 'Pauta não encontrada'), 404],
    [new ValidationError('INVALID_TITLE', 'Título inválido'), 400],
    [new ConflictError('NAME_DUPLICATED', 'Nome já existe'), 409],
    [new ForbiddenError('FORBIDDEN', 'Sem permissão'), 403],
    [new UnauthorizedError('UNAUTHENTICATED', 'Não autenticado'), 401],
  ])('mapeia %o para o status %s pelo kind', (error, expectedStatus) => {
    const { status, json, capture, logger } = create();

    capture(error);

    expect(status).toHaveBeenCalledWith(expectedStatus);
    expect(json).toHaveBeenCalledWith({
      statusCode: expectedStatus,
      code: error.code,
      message: error.message,
    });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        'evt.name': 'http.request.client_error',
        outcome: 'failure',
        'error.code': error.code,
      }),
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it.each([
    [new UnauthorizedException(), 401, 'UNAUTHENTICATED'],
    [new ForbiddenException(), 403, 'FORBIDDEN'],
    [new NotFoundException(), 404, 'NOT_FOUND'],
    [new ThrottlerException(), 429, 'TOO_MANY_REQUESTS'],
    [new BadRequestException(), 400, 'INVALID_REQUEST'],
    [new HttpException('x', 415), 415, 'INVALID_REQUEST'],
  ])('deriva o code de %o', (error, expectedStatus, expectedCode) => {
    const { status, json, capture } = create();

    capture(error);

    expect(status).toHaveBeenCalledWith(expectedStatus);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: expectedStatus,
        code: expectedCode,
        message: expect.any(String),
      }),
    );
  });

  it('preserva code e fields vindos do ValidationPipe', () => {
    const { json, capture } = create();
    const fields = [{ field: 'page', message: 'page deve ser um número' }];

    capture(
      new BadRequestException({
        statusCode: 400,
        code: 'INVALID_REQUEST',
        message: 'Requisição inválida',
        fields,
      }),
    );

    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      code: 'INVALID_REQUEST',
      message: 'Requisição inválida',
      fields,
    });
  });

  it('erro desconhecido vira 500 INTERNAL_ERROR sem vazar a mensagem', () => {
    const { status, json, capture, logger } = create();

    capture(new Error('senha do banco: hunter2'));

    expect(status).toHaveBeenCalledWith(500);
    const body = json.mock.calls[0][0];
    expect(body).toEqual({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Erro interno. Tente novamente em instantes.',
    });
    expect(JSON.stringify(body)).not.toContain('hunter2');
    expect(logger.error).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        'evt.name': 'http.request.server_error',
        outcome: 'failure',
        'error.message': 'senha do banco: hunter2',
        'error.kind': 'Error',
      }),
    );
  });

  it('valor lançado que não é Error também vira 500 genérico', () => {
    const { status, json, capture } = create();

    capture('texto solto');

    expect(status).toHaveBeenCalledWith(500);
    expect(json.mock.calls[0][0]).toMatchObject({ code: 'INTERNAL_ERROR' });
  });

  it('trata erro 4xx de middleware (corpo grande) como erro do cliente', () => {
    const { status, json, capture, logger } = create();
    const error = Object.assign(new Error('request entity too large'), {
      status: 413,
    });

    capture(error);

    expect(status).toHaveBeenCalledWith(413);
    expect(json).toHaveBeenCalledWith({
      statusCode: 413,
      code: 'INVALID_REQUEST',
      message: 'Corpo da requisição acima do limite permitido',
    });
    expect(logger.warn).toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('mantém o corpo detalhado do terminus em 503', () => {
    const { status, json, capture, logger } = create();
    const body = {
      status: 'error',
      info: {},
      error: { database: { status: 'down' } },
      details: { database: { status: 'down' } },
    };

    capture(new ServiceUnavailableException(body));

    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith(body);
    expect(logger.error).toHaveBeenCalled();
  });

  it('HttpException 5xx comum vira INTERNAL_ERROR', () => {
    const { json, capture } = create();

    capture(new HttpException('detalhe interno', 502));

    expect(json.mock.calls[0][0]).toMatchObject({
      statusCode: 502,
      code: 'INTERNAL_ERROR',
    });
    expect(JSON.stringify(json.mock.calls[0][0])).not.toContain('detail');
  });

  it('não loga a query string da requisição', () => {
    const { capture, logger } = create();

    capture(new NotFoundError('X', 'x'));

    expect(logger.warn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ 'http.path': '/api/v1/content-briefs' }),
    );
  });
});
