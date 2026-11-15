import { ApiProperty } from '@nestjs/swagger';

import { ContentBriefAction } from '@/modules/content-brief/domain/enums/content-brief-action';
import { ContentBriefChannel } from '@/modules/content-brief/domain/enums/content-brief-channel';
import { ContentBriefStatus } from '@/modules/content-brief/domain/enums/content-brief-status';
import { DueStatus } from '@/modules/content-brief/domain/enums/due-status';

/** Empreendimento ou responsável como aparece dentro de uma pauta. */
export class RegistrySummaryResponseDto {
  @ApiProperty({
    description: 'Identificador (uuid v7)',
    example: '0192f6a0-7c1e-7a3b-9d52-4f1e8b6c2a10',
  })
  id: string;

  @ApiProperty({ description: 'Nome atual do cadastro', example: 'Bela Vista' })
  name: string;

  @ApiProperty({
    description:
      'Falso quando o cadastro foi arquivado depois de atribuído à pauta',
    example: true,
  })
  active: boolean;
}

/** Quem criou ou alterou a pauta por último. */
export class AuthorResponseDto {
  @ApiProperty({
    description: 'Identificador do usuário no Keycloak (`sub` do token)',
    example: 'f2a1c3d4-5b6e-4f70-8a91-b2c3d4e5f607',
  })
  id: string;

  @ApiProperty({
    description: 'Nome do usuário no momento da gravação (snapshot)',
    example: 'Ana Souza',
    nullable: true,
    type: String,
  })
  name: string | null;
}

export class ContentBriefResponseDto {
  @ApiProperty({
    description: 'Identificador (uuid v7)',
    example: '0192f6a2-9e3b-7d41-a5c8-1f2e3d4c5b6a',
  })
  id: string;

  @ApiProperty({
    description: 'Título da pauta',
    example: 'Post de lançamento do Residencial Ipê',
  })
  title: string;

  @ApiProperty({
    description: 'Descrição (texto vazio quando não há)',
    example: 'Arte aprovada pela diretoria; publicar às 10h.',
  })
  description: string;

  @ApiProperty({
    description: 'Prazo (`YYYY-MM-DD`) ou `null` sem prazo',
    example: '2026-11-14',
    nullable: true,
    type: String,
  })
  dueDate: string | null;

  @ApiProperty({
    description:
      'Situação frente ao prazo, calculada para "hoje" no fuso da operação (ADR-005)',
    enum: DueStatus,
    enumName: 'DueStatus',
    example: DueStatus.TODAY,
  })
  dueStatus: DueStatus;

  @ApiProperty({
    description:
      'Dias de hoje até o prazo (negativo quando passou); `null` sem prazo',
    example: 0,
    nullable: true,
    type: Number,
  })
  daysUntilDue: number | null;

  @ApiProperty({
    description: 'Status da pauta',
    enum: ContentBriefStatus,
    enumName: 'ContentBriefStatus',
    example: ContentBriefStatus.TODO,
  })
  status: ContentBriefStatus;

  @ApiProperty({
    description: 'Ação da pauta ou `null`',
    enum: ContentBriefAction,
    enumName: 'ContentBriefAction',
    nullable: true,
    example: ContentBriefAction.CREATE,
  })
  action: ContentBriefAction | null;

  @ApiProperty({
    description: 'Canal da pauta ou `null`',
    enum: ContentBriefChannel,
    enumName: 'ContentBriefChannel',
    nullable: true,
    example: ContentBriefChannel.INSTAGRAM,
  })
  channel: ContentBriefChannel | null;

  @ApiProperty({
    description: 'Empreendimento da pauta ou `null`',
    type: RegistrySummaryResponseDto,
    nullable: true,
  })
  estateDevelopment: RegistrySummaryResponseDto | null;

  @ApiProperty({
    description: 'Responsável pela pauta ou `null`',
    type: RegistrySummaryResponseDto,
    nullable: true,
  })
  owner: RegistrySummaryResponseDto | null;

  @ApiProperty({
    description:
      'Instante (ISO-8601 UTC) em que entrou em `DONE`; `null` enquanto não concluída',
    example: '2026-11-14T15:30:00.000Z',
    nullable: true,
    type: String,
  })
  completedAt: string | null;

  @ApiProperty({
    description:
      'Versão para concorrência otimista; envie-a de volta em `PUT` e `PATCH .../status`',
    example: 1,
  })
  version: number;

  @ApiProperty({
    description: 'Instante da criação (ISO-8601 UTC)',
    example: '2026-11-14T12:00:00.000Z',
  })
  createdAt: string;

  @ApiProperty({ description: 'Quem criou', type: AuthorResponseDto })
  createdBy: AuthorResponseDto;

  @ApiProperty({
    description: 'Instante da última alteração (ISO-8601 UTC)',
    example: '2026-11-14T12:00:00.000Z',
  })
  updatedAt: string;

  @ApiProperty({
    description: 'Quem alterou por último',
    type: AuthorResponseDto,
  })
  updatedBy: AuthorResponseDto;
}
