import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

import { NO_REGISTRY } from '@/modules/content-brief/application/interfaces/repositories/content-brief-query.repository.interface';
import { ContentBriefAction } from '@/modules/content-brief/domain/enums/content-brief-action';
import { ContentBriefStatus } from '@/modules/content-brief/domain/enums/content-brief-status';

/** Tamanho mínimo e máximo do texto da busca (contrato `q`). */
export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_LENGTH = 100;

/**
 * Converte `a,b,c` (ou o parâmetro repetido `?x=a&x=b`) em lista sem itens
 * vazios nem repetidos. Vazio vira `undefined` (filtro ausente). Valor que
 * não é texto passa como está para o validador recusar.
 */
export function parseCsv({ value }: { value: unknown }): unknown {
  const text = Array.isArray(value) ? value.join(',') : value;
  if (typeof text !== 'string') {
    return value;
  }
  const items = [
    ...new Set(
      text
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    ),
  ];
  return items.length > 0 ? items : undefined;
}

const REGISTRY_ID_MESSAGE = `Informe um UUID válido ou "${NO_REGISTRY}"`;

/**
 * Filtros comuns de `GET /content-briefs` e `GET /content-briefs/summary`.
 * Valor de enum inválido, uuid malformado ou `q` fora de 2 a 100 caracteres
 * devolvem `400 INVALID_REQUEST` com `fields`.
 */
export class ContentBriefFiltersQueryDto {
  @ApiPropertyOptional({
    description:
      'Status, separados por vírgula (`OR` entre os valores): `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`',
    type: String,
    example: 'TODO,IN_PROGRESS',
  })
  @IsOptional()
  @Transform(parseCsv)
  @IsEnum(ContentBriefStatus, { each: true })
  status?: ContentBriefStatus[];

  @ApiPropertyOptional({
    description: `Id do empreendimento (uuid) ou \`${NO_REGISTRY}\` para pautas sem empreendimento`,
    type: String,
    example: NO_REGISTRY,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== NO_REGISTRY)
  @IsUUID(undefined, { message: REGISTRY_ID_MESSAGE })
  estateDevelopmentId?: string;

  @ApiPropertyOptional({
    description: `Id do responsável (uuid) ou \`${NO_REGISTRY}\` para pautas sem responsável`,
    type: String,
    example: NO_REGISTRY,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== NO_REGISTRY)
  @IsUUID(undefined, { message: REGISTRY_ID_MESSAGE })
  ownerId?: string;

  @ApiPropertyOptional({
    description: 'Ação da pauta',
    enum: ContentBriefAction,
    enumName: 'ContentBriefAction',
  })
  @IsOptional()
  @IsEnum(ContentBriefAction)
  action?: ContentBriefAction;

  @ApiPropertyOptional({
    description:
      'Busca textual (2 a 100 caracteres, sem espaços nas pontas), sem caixa e sem acento, em título, descrição, nome do empreendimento e do responsável e rótulos de ação e canal. `%` e `_` valem como texto',
    type: String,
    minLength: SEARCH_MIN_LENGTH,
    maxLength: SEARCH_MAX_LENGTH,
    example: 'plantao',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(SEARCH_MIN_LENGTH, {
    message: `A busca deve ter entre ${SEARCH_MIN_LENGTH} e ${SEARCH_MAX_LENGTH} caracteres`,
  })
  @MaxLength(SEARCH_MAX_LENGTH, {
    message: `A busca deve ter entre ${SEARCH_MIN_LENGTH} e ${SEARCH_MAX_LENGTH} caracteres`,
  })
  q?: string;
}
