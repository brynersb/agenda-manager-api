import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class RenameOwnerRequestDto {
  @ApiProperty({
    description:
      'Novo nome (1 a 80 caracteres após normalizar espaços). Único ignorando caixa e acento.',
    example: 'Ana Souza Lima',
    maxLength: 80,
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description:
      'Novo e-mail. Omitido mantém o atual; `null` ou em branco remove.',
    example: 'ana.souza@bora.com.br',
    nullable: true,
    type: String,
  })
  @IsOptional()
  @IsString()
  email?: string | null;

  @ApiProperty({
    description:
      'Versão do responsável que o cliente leu. Divergência da atual devolve 409 `OWNER_VERSION_OUTDATED`',
    example: 1,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  version: number;
}
