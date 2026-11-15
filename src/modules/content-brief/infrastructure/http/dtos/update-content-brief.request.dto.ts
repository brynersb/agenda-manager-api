import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

import { CreateContentBriefRequestDto } from '@/modules/content-brief/infrastructure/http/dtos/create-content-brief.request.dto';

/**
 * Corpo de `PUT /content-briefs/:id`: **substituição completa**. Campo ausente não
 * mantém o valor atual: limpa (descrição vira vazia; prazo, ação, canal,
 * empreendimento e responsável viram `null`). Só `status` ausente mantém o
 * atual. O cliente deve sempre enviar todos os campos.
 */
export class UpdateContentBriefRequestDto extends CreateContentBriefRequestDto {
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
