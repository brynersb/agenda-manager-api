import { ApiProperty } from '@nestjs/swagger';

/** Contagem de pautas por situação do prazo; todas as chaves sempre presentes. */
export class DueStatusCountsResponseDto {
  @ApiProperty({ description: 'Abertas com prazo anterior a hoje', example: 2 })
  overdue: number;

  @ApiProperty({ description: 'Abertas com prazo hoje', example: 1 })
  today: number;

  @ApiProperty({
    description: 'Abertas com prazo de amanhã a hoje + 7 dias',
    example: 4,
  })
  'next-7-days': number;

  @ApiProperty({
    description: 'Abertas com prazo depois de hoje + 7 dias',
    example: 3,
  })
  later: number;

  @ApiProperty({ description: 'Abertas sem prazo', example: 5 })
  'no-due-date': number;

  @ApiProperty({
    description: 'Concluídas (`DONE`), com ou sem prazo',
    example: 8,
  })
  completed: number;
}

/** Contagem de pautas por status; todas as chaves sempre presentes. */
export class StatusCountsResponseDto {
  @ApiProperty({ example: 6 })
  TODO: number;

  @ApiProperty({ example: 4 })
  IN_PROGRESS: number;

  @ApiProperty({ example: 2 })
  IN_REVIEW: number;

  @ApiProperty({ example: 8 })
  DONE: number;
}

export class ContentBriefSummaryResponseDto {
  @ApiProperty({
    description:
      'Dia de referência das contagens por situação do prazo (`YYYY-MM-DD`, fuso `APP_TIMEZONE`)',
    example: '2026-11-14',
  })
  today: string;

  @ApiProperty({
    description: 'Total de pautas que casam com os filtros',
    example: 20,
  })
  total: number;

  @ApiProperty({
    description: 'Pautas por situação do prazo (a soma é o `total`)',
    type: DueStatusCountsResponseDto,
  })
  byDueStatus: DueStatusCountsResponseDto;

  @ApiProperty({
    description: 'Pautas por status (a soma é o `total`)',
    type: StatusCountsResponseDto,
  })
  byStatus: StatusCountsResponseDto;
}
