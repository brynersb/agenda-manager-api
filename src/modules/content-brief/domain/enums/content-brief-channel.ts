/** Onde a pauta será publicada ou trabalhada. */
export enum ContentBriefChannel {
  INSTAGRAM = 'INSTAGRAM',
  EMAIL = 'EMAIL',
  BLOG = 'BLOG',
  ADS = 'ADS',
  VIDEO = 'VIDEO',
  WEBSITE = 'WEBSITE',
  REPORT = 'REPORT',
  OTHER = 'OTHER',
}

/** Rótulo pt-BR de cada canal; a busca textual usa. */
export const CHANNEL_LABEL: Record<ContentBriefChannel, string> = {
  [ContentBriefChannel.INSTAGRAM]: 'Instagram',
  [ContentBriefChannel.EMAIL]: 'E-mail',
  [ContentBriefChannel.BLOG]: 'Blog',
  [ContentBriefChannel.ADS]: 'Anúncios',
  [ContentBriefChannel.VIDEO]: 'Vídeo',
  [ContentBriefChannel.WEBSITE]: 'Site',
  [ContentBriefChannel.REPORT]: 'Relatório',
  [ContentBriefChannel.OTHER]: 'Outro',
};
