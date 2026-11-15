import { ContentBriefResponseDto } from '@/modules/content-brief/infrastructure/http/dtos/content-brief.response.dto';
import { pageResponseDto } from '@/shared/infrastructure/http/pagination/page.response';

/** Página de pautas: `{ data, total, page, limit }`. */
export class ListContentBriefsResponseDto extends pageResponseDto(
  ContentBriefResponseDto,
) {}
