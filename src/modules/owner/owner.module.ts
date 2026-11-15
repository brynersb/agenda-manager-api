import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OWNER_REPOSITORY } from '@/modules/owner/application/interfaces/repositories/owner.repository.interface';
import { OWNER_QUERY_REPOSITORY } from '@/modules/owner/application/interfaces/repositories/owner-query.repository.interface';
import { ArchiveOwnerProvider } from '@/modules/owner/application/providers/archive-owner.provider';
import { CreateOwnerProvider } from '@/modules/owner/application/providers/create-owner.provider';
import { ListOwnersProvider } from '@/modules/owner/application/providers/list-owners.provider';
import { ReactivateOwnerProvider } from '@/modules/owner/application/providers/reactivate-owner.provider';
import { RenameOwnerProvider } from '@/modules/owner/application/providers/rename-owner.provider';
import { OwnerController } from '@/modules/owner/infrastructure/http/controllers/owner.controller';
import { OwnerEntity } from '@/modules/owner/infrastructure/persistence/entities/owner.entity';
import { OwnerRepository } from '@/modules/owner/infrastructure/persistence/repositories/owner/owner.repository';
import { OwnerQueryRepository } from '@/modules/owner/infrastructure/persistence/repositories/owner/owner-query.repository';

/** Cadastro de responsáveis: `/api/v1/owners`. */
@Module({
  imports: [TypeOrmModule.forFeature([OwnerEntity])],
  controllers: [OwnerController],
  providers: [
    {
      provide: OWNER_REPOSITORY,
      useClass: OwnerRepository,
    },
    {
      provide: OWNER_QUERY_REPOSITORY,
      useClass: OwnerQueryRepository,
    },
    CreateOwnerProvider,
    RenameOwnerProvider,
    ArchiveOwnerProvider,
    ReactivateOwnerProvider,
    ListOwnersProvider,
  ],
})
export class OwnerModule {}
