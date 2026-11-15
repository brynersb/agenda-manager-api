import { AsyncLocalStorage } from 'node:async_hooks';

export type RequestContext = { requestId: string };

/**
 * Contexto da requisição corrente. Permite que o logger anexe o `request_id`
 * a qualquer log emitido durante a requisição, sem passar o id de mão em mão.
 */
export const requestContext = new AsyncLocalStorage<RequestContext>();
