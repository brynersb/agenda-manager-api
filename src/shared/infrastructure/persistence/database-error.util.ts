/** Código SQLSTATE do Postgres para violação de unicidade. */
const UNIQUE_VIOLATION = '23505';

type DatabaseErrorShape = {
  code?: unknown;
  constraint?: unknown;
  driverError?: DatabaseErrorShape;
};

/**
 * Diz se `error` é uma violação de unicidade do Postgres (`23505`),
 * opcionalmente de uma constraint/índice específico. Enxerga o erro do driver
 * dentro do `QueryFailedError` do TypeORM (`driverError`).
 */
export function isUniqueViolation(
  error: unknown,
  constraint?: string,
): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const { driverError, ...own } = error as DatabaseErrorShape;
  const dbError: DatabaseErrorShape =
    driverError && typeof driverError === 'object' ? driverError : own;

  if (dbError.code !== UNIQUE_VIOLATION) {
    return false;
  }
  return constraint === undefined || dbError.constraint === constraint;
}
