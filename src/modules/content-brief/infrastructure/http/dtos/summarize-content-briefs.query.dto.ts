import { ApiHideProperty } from '@nestjs/swagger';
import { Allow } from 'class-validator';

import { ContentBriefFiltersQueryDto } from '@/modules/content-brief/infrastructure/http/dtos/content-brief-filters.query.dto';

/**
 * Query de `GET /content-briefs/summary`: os filtros comuns. `dueStatus`,
 * `page`, `limit` e `sort` são aceitos e **ignorados** (contrato): assim a UI
 * pode reaproveitar a mesma query da listagem sem tomar `400`. Ficam fora do
 * Swagger.
 */
export class SummarizeContentBriefsQueryDto extends ContentBriefFiltersQueryDto {
  @ApiHideProperty()
  @Allow()
  dueStatus?: unknown;

  @ApiHideProperty()
  @Allow()
  page?: unknown;

  @ApiHideProperty()
  @Allow()
  limit?: unknown;

  @ApiHideProperty()
  @Allow()
  sort?: unknown;
}
