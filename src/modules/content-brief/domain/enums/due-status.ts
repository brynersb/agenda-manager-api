/**
 * Situação de uma pauta frente ao prazo, calculada por `classifyDueDate`
 * (ADR-005). Não é gravada: depende de "hoje".
 */
export enum DueStatus {
  OVERDUE = 'overdue',
  TODAY = 'today',
  NEXT_7_DAYS = 'next-7-days',
  LATER = 'later',
  NO_DUE_DATE = 'no-due-date',
  COMPLETED = 'completed',
}
