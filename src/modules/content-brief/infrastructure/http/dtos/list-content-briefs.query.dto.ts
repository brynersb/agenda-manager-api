import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional } from 'class-validator';

import { ContentBriefSort } from '@/modules/content-brief/domain/enums/content-brief-sort';
import { DueStatus } from '@/modules/content-brief/domain/enums/due-status';
import {
  ContentBriefFiltersQueryDto,
  parseCsv,
} from '@/modules/content-brief/infrastructure/http/dtos/content-brief-filters.query.dto';
import { PaginationQueryDto } from '@/shared/infrastructure/http/pagination/pagination-query.dto';

/** Query de `GET /content-briefs`: filtros comuns, situação do prazo, ordem e página. */
export class ListContentBriefsQueryDto extends IntersectionType(
  ContentBriefFiltersQueryDto,
  PaginationQueryDto,
) {
  @ApiPropertyOptional({
    description:
      'Situação do prazo, separadas por vírgula (`OR` entre os valores), calculada em SQL com "hoje" no fuso da operação: `overdue`, `today`, `next-7-days`, `later`, `no-due-date`, `completed`',
    type: String,
    example: 'overdue,today',
  })
  @IsOptional()
  @Transform(parseCsv)
  @IsEnum(DueStatus, { each: true })
  dueStatus?: DueStatus[];

  @ApiPropertyOptional({
    description:
      'Ordenação. Nas duas de prazo, pauta sem prazo vem por último; desempate por título (pt-BR)',
    enum: ContentBriefSort,
    enumName: 'ContentBriefSort',
    default: ContentBriefSort.DUE_DATE,
  })
  @IsOptional()
  @IsEnum(ContentBriefSort)
  sort: ContentBriefSort = ContentBriefSort.DUE_DATE;
}
