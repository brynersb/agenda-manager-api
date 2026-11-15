import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

/** Query de `GET /owners`: `includeArchived` aceita `true`/`false`. */
export class ListRegistriesQueryDto {
  @ApiPropertyOptional({
    description: 'Inclui os responsáveis arquivados na lista',
    type: Boolean,
    default: false,
    example: false,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  includeArchived: boolean = false;
}
