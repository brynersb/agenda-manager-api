import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Min } from 'class-validator';

export class RenameEstateDevelopmentRequestDto {
  @ApiProperty({
    description:
      'Novo nome (1 a 80 caracteres após normalizar espaços). Único ignorando caixa e acento.',
    example: 'Residencial Ipê Amarelo',
    maxLength: 80,
  })
  @IsString()
  name: string;

  @ApiProperty({
    description:
      'Versão do empreendimento que o cliente leu. Divergência da atual devolve 409 `ESTATE_DEVELOPMENT_VERSION_OUTDATED`',
    example: 1,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  version: number;
}
