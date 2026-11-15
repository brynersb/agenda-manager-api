import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, Min } from 'class-validator';

import { ContentBriefStatus } from '@/modules/content-brief/domain/enums/content-brief-status';

export class ChangeContentBriefStatusRequestDto {
  @ApiProperty({
    description: 'Novo status (a troca é livre entre os quatro valores)',
    enum: ContentBriefStatus,
    enumName: 'ContentBriefStatus',
    example: ContentBriefStatus.IN_PROGRESS,
  })
  @IsEnum(ContentBriefStatus)
  status: ContentBriefStatus;

  @ApiProperty({
    description:
      'Versão da pauta que o cliente leu. Divergência da atual devolve 409 `CONTENT_BRIEF_VERSION_OUTDATED`',
    example: 1,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  version: number;
}
