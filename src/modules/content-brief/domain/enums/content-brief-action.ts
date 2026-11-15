/** O que a pauta pede para ser feito (verbo do protótipo). */
export enum ContentBriefAction {
  CHASE = 'CHASE',
  DEVELOP = 'DEVELOP',
  PAYMENT = 'PAYMENT',
  CREATE = 'CREATE',
  FOLLOW_UP = 'FOLLOW_UP',
  ANALYZE = 'ANALYZE',
}

/** Rótulo pt-BR de cada ação; a busca textual usa. */
export const ACTION_LABEL: Record<ContentBriefAction, string> = {
  [ContentBriefAction.CHASE]: 'Cobrar',
  [ContentBriefAction.DEVELOP]: 'Desenvolver',
  [ContentBriefAction.PAYMENT]: 'Pagamento',
  [ContentBriefAction.CREATE]: 'Criar',
  [ContentBriefAction.FOLLOW_UP]: 'Acompanhar',
  [ContentBriefAction.ANALYZE]: 'Analisar',
};
