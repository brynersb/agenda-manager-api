import type { OwnerReadModel } from '@/modules/owner/application/interfaces/repositories/owner-query.repository.interface';
import type { Actor } from '@/shared/domain/actor';

export type ArchiveOwnerInput = { id: string; actor: Actor };

export interface ArchiveOwnerUseCaseInterface {
  execute(input: ArchiveOwnerInput): Promise<OwnerReadModel>;
}

export const ARCHIVE_OWNER_USE_CASE = Symbol('ArchiveOwnerUseCaseInterface');
