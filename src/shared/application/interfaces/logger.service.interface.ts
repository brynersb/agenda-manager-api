/**
 * Porta de log. Fica em `application/ports` (e não em `infrastructure`) para que
 * casos de uso possam recebê-la sem violar a regra de camadas do Biome
 * (ADR-013); a implementação Winston está em `shared/infrastructure/logger`.
 */
export interface LoggerServiceInterface {
  log(message: string, metadata?: unknown): void;
  info(message: string, metadata?: unknown): void;
  warn(message: string, metadata?: unknown): void;
  error(message: string, metadata?: unknown): void;
  debug(message: string, metadata?: unknown): void;
  setLogPrefix(logPrefix: string): void;
}

export const LOGGER_SERVICE = Symbol('LoggerServiceInterface');
