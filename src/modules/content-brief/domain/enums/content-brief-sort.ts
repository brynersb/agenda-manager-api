/**
 * Ordenação da listagem de pautas. Em todas, o desempate é estável (título
 * em pt-BR e id), e a pauta sem prazo vem por último nas duas de prazo.
 */
export enum ContentBriefSort {
  /** Prazo mais próximo primeiro (padrão, igual ao `cmpDate()` do protótipo). */
  DUE_DATE = 'dueDate',
  /** Prazo mais distante primeiro (usado nas concluídas). */
  DUE_DATE_DESC = '-dueDate',
  /** Alteradas mais recentemente primeiro. */
  UPDATED_AT = 'updatedAt',
}
