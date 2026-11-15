import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

import { REQUEST_ID_HEADER } from '@/shared/infrastructure/http/request-id.middleware';

/** Converte o CSV de `CORS_ORIGINS` em lista, descartando vazios e espaços. */
export function parseCorsOrigins(csv: string): string[] {
  return csv
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

/** CORS só para as origens listadas (sem `*`); a UI lê o `x-request-id`. */
export function buildCorsOptions(origins: string[]): CorsOptions {
  return {
    origin: origins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    exposedHeaders: [REQUEST_ID_HEADER],
    maxAge: 600,
  };
}
