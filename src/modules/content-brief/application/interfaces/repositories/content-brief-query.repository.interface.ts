import type { ContentBriefAction } from '@/modules/content-brief/domain/enums/content-brief-action';
import type { ContentBriefChannel } from '@/modules/content-brief/domain/enums/content-brief-channel';
import type { ContentBriefSort } from '@/modules/content-brief/domain/enums/content-brief-sort';
import type { ContentBriefStatus } from '@/modules/content-brief/domain/enums/content-brief-status';
import type { DueStatus } from '@/modules/content-brief/domain/enums/due-status';
import type { CalendarDate } from '@/shared/domain/calendar-date';

/** Cadastro referenciado por uma pauta, com o nome atual e se está ativo. */
export type RegistrySummary = { id: string; name: string; active: boolean };

/** Quem criou ou alterou a pauta: id do token e snapshot do nome. */
export type AuthorSummary = { id: string; name: string | null };

/**
 * Read model de uma pauta, sem a situação do prazo (que depende de "hoje" e
 * é aplicada pela query com `classifyDueDate`).
 */
export type ContentBriefReadModel = {
  id: string;
  title: string;
  description: string;
  dueDate: CalendarDate | null;
  status: ContentBriefStatus;
  action: ContentBriefAction | null;
  channel: ContentBriefChannel | null;
  estateDevelopment: RegistrySummary | null;
  owner: RegistrySummary | null;
  completedAt: Date | null;
  version: number;
  createdAt: Date;
  createdBy: AuthorSummary;
  updatedAt: Date;
  updatedBy: AuthorSummary;
};

/** Valor de `estateDevelopmentId`/`ownerId` que filtra pautas sem vínculo. */
export const NO_REGISTRY = 'none';

/**
 * Filtros comuns à listagem e ao resumo. Campo ausente não filtra; vários
 * `status` valem como `OR`. `estateDevelopmentId` e `ownerId` aceitam um uuid
 * ou `NO_REGISTRY` (pautas sem vínculo). `searchTerm` é o texto digitado
 * (sem escape): a busca ignora caixa e acento.
 */
export type ContentBriefCommonFilter = {
  status?: ContentBriefStatus[];
  estateDevelopmentId?: string;
  ownerId?: string;
  action?: ContentBriefAction;
  searchTerm?: string;
  /** Dia de referência da situação do prazo (`ClockInterface.today()`). */
  today: CalendarDate;
};

/** Filtro da listagem: os comuns, mais situação do prazo, ordem e página. */
export type ContentBriefListFilter = ContentBriefCommonFilter & {
  /** Vários valores valem como `OR`. */
  dueStatus?: DueStatus[];
  sort: ContentBriefSort;
  /** A partir de 1. */
  page: number;
  limit: number;
};

/** Uma página de pautas e o total que casa com o filtro (sem paginar). */
export type ContentBriefPage = {
  items: ContentBriefReadModel[];
  total: number;
};

/** Contagens do resumo: todas as chaves sempre presentes (zero quando vazio). */
export type ContentBriefCounts = {
  total: number;
  byDueStatus: Record<DueStatus, number>;
  byStatus: Record<ContentBriefStatus, number>;
};

/** Consultas de leitura (CQRS leve): devolvem read model, não o agregado. */
export interface ContentBriefQueryRepositoryInterface {
  /** `null` se não existe ou foi excluída. */
  findOneById(id: string): Promise<ContentBriefReadModel | null>;

  /** Pautas não excluídas que casam com o filtro, já ordenadas e paginadas. */
  findAll(filter: ContentBriefListFilter): Promise<ContentBriefPage>;

  /**
   * Contagens por situação do prazo e por status das pautas não excluídas
   * que casam com os filtros comuns, em uma única consulta.
   */
  summarize(filter: ContentBriefCommonFilter): Promise<ContentBriefCounts>;
}

export const CONTENT_BRIEF_QUERY_REPOSITORY = Symbol(
  'ContentBriefQueryRepositoryInterface',
);
