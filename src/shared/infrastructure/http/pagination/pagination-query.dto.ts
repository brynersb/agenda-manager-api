import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Query de paginação (ADR-010): `page` de 1 a 100.000, `limit` de 1 a 200.
 * O teto de `page` evita que um valor absurdo (ex.: `1e20`) estoure o `OFFSET`
 * do banco e vire erro 500 em vez de 400.
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Página (a partir de 1)',
    minimum: 1,
    maximum: 100000,
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Itens por página',
    minimum: 1,
    maximum: 200,
    default: 50,
    example: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit: number = 50;
}
