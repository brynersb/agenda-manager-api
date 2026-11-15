/**
 * Quem executa uma ação. Os casos de uso recebem um `Actor` (nunca o request)
 * e o gravam como snapshot na auditoria (`created_by`, `created_by_name`...).
 */
export type Actor = { id: string; name: string | null };
