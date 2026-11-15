import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ESTATE_DEVELOPMENT_REPOSITORY } from '@/modules/estate-development/application/interfaces/repositories/estate-development.repository.interface';
import { ESTATE_DEVELOPMENT_QUERY_REPOSITORY } from '@/modules/estate-development/application/interfaces/repositories/estate-development-query.repository.interface';
import { ArchiveEstateDevelopmentProvider } from '@/modules/estate-development/application/providers/archive-estate-development.provider';
import { CreateEstateDevelopmentProvider } from '@/modules/estate-development/application/providers/create-estate-development.provider';
import { ListEstateDevelopmentsProvider } from '@/modules/estate-development/application/providers/list-estate-developments.provider';
import { ReactivateEstateDevelopmentProvider } from '@/modules/estate-development/application/providers/reactivate-estate-development.provider';
import { RenameEstateDevelopmentProvider } from '@/modules/estate-development/application/providers/rename-estate-development.provider';
import { EstateDevelopmentController } from '@/modules/estate-development/infrastructure/http/controllers/estate-development.controller';
import { EstateDevelopmentEntity } from '@/modules/estate-development/infrastructure/persistence/entities/estate-development.entity';
import { EstateDevelopmentRepository } from '@/modules/estate-development/infrastructure/persistence/repositories/estate-development/estate-development.repository';
import { EstateDevelopmentQueryRepository } from '@/modules/estate-development/infrastructure/persistence/repositories/estate-development/estate-development-query.repository';

/** Cadastro de empreendimentos: `/api/v1/estate-developments`. */
@Module({
  imports: [TypeOrmModule.forFeature([EstateDevelopmentEntity])],
  controllers: [EstateDevelopmentController],
  providers: [
    {
      provide: ESTATE_DEVELOPMENT_REPOSITORY,
      useClass: EstateDevelopmentRepository,
    },
    {
      provide: ESTATE_DEVELOPMENT_QUERY_REPOSITORY,
      useClass: EstateDevelopmentQueryRepository,
    },
    CreateEstateDevelopmentProvider,
    RenameEstateDevelopmentProvider,
    ArchiveEstateDevelopmentProvider,
    ReactivateEstateDevelopmentProvider,
    ListEstateDevelopmentsProvider,
  ],
})
export class EstateDevelopmentModule {}
