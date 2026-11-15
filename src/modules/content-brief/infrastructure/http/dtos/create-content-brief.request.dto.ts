import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

import { ContentBriefAction } from '@/modules/content-brief/domain/enums/content-brief-action';
import { ContentBriefChannel } from '@/modules/content-brief/domain/enums/content-brief-channel';
import { ContentBriefStatus } from '@/modules/content-brief/domain/enums/content-brief-status';

/**
 * Campos de uma pauta no corpo de `POST /content-briefs`. O `PUT` reaproveita a lista
 * (ver `UpdateContentBriefRequestDto`). `null` explícito e ausente valem o mesmo:
 * "sem valor".
 */
export class CreateContentBriefRequestDto {
  @ApiProperty({
    description:
      'Título da pauta. Espaços nas pontas são removidos; de 1 a 140 caracteres.',
    example: 'Post de lançamento do Residencial Ipê',
    maxLength: 140,
  })
  @IsString()
  title: string;

  @ApiPropertyOptional({
    description:
      'Descrição (até 1200 caracteres, sem espaços nas pontas). Ausente ou `null` vira texto vazio.',
    example: 'Arte aprovada pela diretoria; publicar às 10h.',
    maxLength: 1200,
    nullable: true,
    type: String,
  })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({
    description:
      'Prazo, data de calendário `YYYY-MM-DD` (sem hora). Ausente ou `null` significa sem prazo. Uma data inexistente (`2026-02-30`) devolve 400 `INVALID_REQUEST`.',
    example: '2026-11-14',
    nullable: true,
    type: String,
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Informe o prazo no formato AAAA-MM-DD',
  })
  dueDate?: string | null;

  @ApiPropertyOptional({
    description:
      'Status. No `POST` o padrão é `TODO`; no `PUT` ausente mantém o status atual.',
    enum: ContentBriefStatus,
    enumName: 'ContentBriefStatus',
    example: ContentBriefStatus.TODO,
  })
  @IsOptional()
  @IsEnum(ContentBriefStatus)
  status?: ContentBriefStatus;

  @ApiPropertyOptional({
    description: 'Ação da pauta. Ausente ou `null` significa sem ação.',
    enum: ContentBriefAction,
    enumName: 'ContentBriefAction',
    nullable: true,
    example: ContentBriefAction.CREATE,
  })
  @IsOptional()
  @IsEnum(ContentBriefAction)
  action?: ContentBriefAction | null;

  @ApiPropertyOptional({
    description: 'Canal da pauta. Ausente ou `null` significa sem canal.',
    enum: ContentBriefChannel,
    enumName: 'ContentBriefChannel',
    nullable: true,
    example: ContentBriefChannel.INSTAGRAM,
  })
  @IsOptional()
  @IsEnum(ContentBriefChannel)
  channel?: ContentBriefChannel | null;

  @ApiPropertyOptional({
    description:
      'Id do empreendimento (uuid). Precisa existir e estar ativo quando é atribuído ou trocado (`ESTATE_DEVELOPMENT_UNAVAILABLE`). Ausente ou `null` significa sem empreendimento.',
    example: '0192f6a0-7c1e-7a3b-9d52-4f1e8b6c2a10',
    nullable: true,
    type: String,
  })
  @IsOptional()
  @IsUUID()
  estateDevelopmentId?: string | null;

  @ApiPropertyOptional({
    description:
      'Id do responsável (uuid). Mesma regra do empreendimento (`OWNER_UNAVAILABLE`). Ausente ou `null` significa sem responsável.',
    example: '0192f6a1-2d4e-7c10-8a37-6b9d3e5f7a21',
    nullable: true,
    type: String,
  })
  @IsOptional()
  @IsUUID()
  ownerId?: string | null;
}
