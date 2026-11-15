import type { NextFunction, Request, Response } from 'express';

import { requestContext } from '@/shared/infrastructure/http/request-context';
import { RequestIdMiddleware } from '@/shared/infrastructure/http/request-id.middleware';

function execute(receivedId?: string) {
  const setHeader = vi.fn();
  const req = { header: () => receivedId } as unknown as Request;
  const res = { setHeader } as unknown as Response;
  let idInContext: string | undefined;
  const next: NextFunction = () => {
    idInContext = requestContext.getStore()?.requestId;
  };

  new RequestIdMiddleware().use(req, res, next);

  return { setHeader, idInContext };
}

describe('RequestIdMiddleware', () => {
  it('gera um uuid quando o header não vem', () => {
    const { setHeader, idInContext } = execute();

    expect(idInContext).toMatch(/^[0-9a-f-]{36}$/);
    expect(setHeader).toHaveBeenCalledWith('x-request-id', idInContext);
  });

  it('reaproveita um id válido recebido', () => {
    const { setHeader, idInContext } = execute('abc-123');

    expect(idInContext).toBe('abc-123');
    expect(setHeader).toHaveBeenCalledWith('x-request-id', 'abc-123');
  });

  it('descarta um id com caracteres inválidos', () => {
    const { idInContext } = execute('x y\nz');

    expect(idInContext).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('não vaza o contexto para fora da requisição', () => {
    execute('abc');

    expect(requestContext.getStore()).toBeUndefined();
  });
});
