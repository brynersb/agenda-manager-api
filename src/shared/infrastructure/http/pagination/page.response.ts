import type { Type } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

/** Formato único de lista paginada: `{ data, total, page, limit }`. */
export class PageResponse<T> {
  data: T[];

  @ApiProperty({ description: 'Total de itens que casam com o filtro' })
  total: number;

  @ApiProperty({ description: 'Página devolvida', example: 1 })
  page: number;

  @ApiProperty({ description: 'Itens por página', example: 50 })
  limit: number;
}

/** Monta a resposta paginada. Lista vazia continua sendo 200 com `data: []`. */
export function toPageResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PageResponse<T> {
  return { data, total, page, limit };
}

/**
 * Cria a classe concreta de resposta paginada de um item, para o Swagger
 * enxergar o tipo de `data` (genéricos somem em tempo de execução).
 *
 * @example
 * export class ListContentBriefsResponseDto extends pageResponseDto(ContentBriefResponseDto) {}
 */
export function pageResponseDto<T>(item: Type<T>) {
  class PageResponseDto extends PageResponse<T> {
    @ApiProperty({ type: [item], description: 'Itens da página' })
    declare data: T[];
  }
  return PageResponseDto;
}
