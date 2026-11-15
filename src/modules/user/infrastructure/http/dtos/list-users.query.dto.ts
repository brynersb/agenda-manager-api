import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import { UserStatus } from '@/modules/user/domain/enums/user-status';
import { PaginationQueryDto } from '@/shared/infrastructure/http/pagination/pagination-query.dto';

/** Tamanho mínimo e máximo do texto da busca (`q`). */
export const SEARCH_MIN_LENGTH = 1;
export const SEARCH_MAX_LENGTH = 100;

const SEARCH_MESSAGE = `A busca deve ter entre ${SEARCH_MIN_LENGTH} e ${SEARCH_MAX_LENGTH} caracteres`;

/** Query de `GET /users`: busca, situação e página. */
export class ListUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      'Busca por nome ou e-mail, sem diferenciar caixa nem acento (contém o texto)',
    minLength: SEARCH_MIN_LENGTH,
    maxLength: SEARCH_MAX_LENGTH,
    example: 'maria',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(SEARCH_MIN_LENGTH, { message: SEARCH_MESSAGE })
  @MaxLength(SEARCH_MAX_LENGTH, { message: SEARCH_MESSAGE })
  q?: string;

  @ApiPropertyOptional({
    description: 'Filtra pela situação. Omitido traz ativos e desativados.',
    enum: UserStatus,
    enumName: 'UserStatus',
  })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
