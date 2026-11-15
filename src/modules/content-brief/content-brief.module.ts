import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CONTENT_BRIEF_REPOSITORY } from '@/modules/content-brief/application/interfaces/repositories/content-brief.repository.interface';
import { CONTENT_BRIEF_QUERY_REPOSITORY } from '@/modules/content-brief/application/interfaces/repositories/content-brief-query.repository.interface';
import { REGISTRY_QUERY_REPOSITORY } from '@/modules/content-brief/application/interfaces/repositories/registry-query.repository.interface';
import { ChangeContentBriefStatusProvider } from '@/modules/content-brief/application/providers/change-content-brief-status.provider';
import { CreateContentBriefProvider } from '@/modules/content-brief/application/providers/create-content-brief.provider';
import { DeleteContentBriefProvider } from '@/modules/content-brief/application/providers/delete-content-brief.provider';
import { FindContentBriefByIdProvider } from '@/modules/content-brief/application/providers/find-content-brief-by-id.provider';
import { ListContentBriefsProvider } from '@/modules/content-brief/application/providers/list-content-briefs.provider';
import { SummarizeContentBriefsProvider } from '@/modules/content-brief/application/providers/summarize-content-briefs.provider';
import { UpdateContentBriefProvider } from '@/modules/content-brief/application/providers/update-content-brief.provider';
import { ContentBriefController } from '@/modules/content-brief/infrastructure/http/controllers/content-brief.controller';
import { ContentBriefEntity } from '@/modules/content-brief/infrastructure/persistence/entities/content-brief.entity';
import { ContentBriefRepository } from '@/modules/content-brief/infrastructure/persistence/repositories/content-brief/content-brief.repository';
import { ContentBriefQueryRepository } from '@/modules/content-brief/infrastructure/persistence/repositories/content-brief/content-brief-query.repository';
import { RegistryQueryRepository } from '@/modules/content-brief/infrastructure/persistence/repositories/registry/registry-query.repository';

/** Pautas de marketing: `/api/v1/content-briefs`. */
@Module({
  imports: [TypeOrmModule.forFeature([ContentBriefEntity])],
  controllers: [ContentBriefController],
  providers: [
    {
      provide: CONTENT_BRIEF_REPOSITORY,
      useClass: ContentBriefRepository,
    },
    {
      provide: CONTENT_BRIEF_QUERY_REPOSITORY,
      useClass: ContentBriefQueryRepository,
    },
    {
      provide: REGISTRY_QUERY_REPOSITORY,
      useClass: RegistryQueryRepository,
    },
    CreateContentBriefProvider,
    UpdateContentBriefProvider,
    ChangeContentBriefStatusProvider,
    DeleteContentBriefProvider,
    FindContentBriefByIdProvider,
    ListContentBriefsProvider,
    SummarizeContentBriefsProvider,
  ],
})
export class ContentBriefModule {}
