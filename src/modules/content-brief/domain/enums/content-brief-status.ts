/** Estado de andamento de uma pauta; muda livremente entre os quatro valores. */
export enum ContentBriefStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  IN_REVIEW = 'IN_REVIEW',
  DONE = 'DONE',
}

/** Rótulo pt-BR de cada status (o mesmo do protótipo); a busca textual usa. */
export const STATUS_LABEL: Record<ContentBriefStatus, string> = {
  [ContentBriefStatus.TODO]: 'A fazer',
  [ContentBriefStatus.IN_PROGRESS]: 'Em andamento',
  [ContentBriefStatus.IN_REVIEW]: 'Em revisão',
  [ContentBriefStatus.DONE]: 'Concluída',
};
