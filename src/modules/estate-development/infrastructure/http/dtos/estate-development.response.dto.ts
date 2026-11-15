import { ApiProperty } from '@nestjs/swagger';

export class EstateDevelopmentResponseDto {
  @ApiProperty({
    description: 'Identificador (uuid v7)',
    example: '0192f6a0-7c1e-7a3b-9d52-4f1e8b6c2a10',
  })
  id: string;

  @ApiProperty({ description: 'Nome do empreendimento', example: 'Bela Vista' })
  name: string;

  @ApiProperty({
    description: 'Falso quando arquivado (some da lista padrão)',
    example: true,
  })
  active: boolean;

  @ApiProperty({
    description:
      'Versão para concorrência otimista; envie-a de volta em `PATCH`',
    example: 1,
  })
  version: number;

  @ApiProperty({
    description:
      'Quantas pautas não concluídas usam o empreendimento (aviso antes de arquivar)',
    example: 0,
  })
  openContentBriefs: number;
}
