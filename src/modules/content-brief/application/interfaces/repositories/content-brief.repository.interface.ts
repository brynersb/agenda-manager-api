import type { ContentBriefDomainEntity } from '@/modules/content-brief/domain/entities/content-brief.domain-entity';

/** Persistência do agregado `ContentBriefDomainEntity`. Nunca devolve pautas excluídas. */
export interface ContentBriefRepositoryInterface {
  /** `null` se não existe ou foi excluída. */
  findById(id: string): Promise<ContentBriefDomainEntity | null>;

  create(contentBrief: ContentBriefDomainEntity): Promise<void>;

  /**
   * `UPDATE ... WHERE id = :id AND version = :expectedVersion AND deleted_at IS
   * NULL` (a checagem de versão precisa estar no `WHERE`: o `@VersionColumn`
   * do TypeORM só incrementa, não impede sobrescrita). Sem linha afetada,
   * recarrega: lança `ContentBriefNotFoundError` se a pauta sumiu ou
   * `ContentBriefVersionOutdatedError` se outra pessoa gravou antes.
   */
  update(
    contentBrief: ContentBriefDomainEntity,
    expectedVersion: number,
  ): Promise<void>;

  /**
   * Exclusão lógica (grava `deleted_at`/`deleted_by` da pauta). Lança
   * `ContentBriefNotFoundError` se ela já não existe.
   */
  softDelete(contentBrief: ContentBriefDomainEntity): Promise<void>;
}

export const CONTENT_BRIEF_REPOSITORY = Symbol(
  'ContentBriefRepositoryInterface',
);
