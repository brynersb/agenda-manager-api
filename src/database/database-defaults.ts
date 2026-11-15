/**
 * Padrões do Postgres do `docker/compose.yaml` (porta 5433 do host). Só valem
 * em `STAGE=local` e na CLI de migrations. Arquivo sem imports de propósito:
 * é lido pelo `typeorm.config.ts` (que roda direto do TypeScript, sem alias
 * `@/`) e pela validação de ambiente.
 */
export const DATABASE_LOCAL_DEFAULTS = {
  host: 'localhost',
  port: 5433,
  user: 'pauta',
  pass: 'pauta',
  name: 'pauta',
  poolMax: 10,
} as const;
