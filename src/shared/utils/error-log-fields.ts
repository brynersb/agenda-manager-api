/**
 * Extrai `error.message` e `error.kind` no formato dos logs estruturados.
 * Centralizado para que uma mudança de formato não precise tocar cada ponto
 * que loga uma falha.
 */
export function toErrorLogFields(error: unknown): {
  'error.message': string;
  'error.kind': string | undefined;
} {
  return {
    'error.message': error instanceof Error ? error.message : String(error),
    'error.kind': error instanceof Error ? error.constructor.name : undefined,
  };
}
