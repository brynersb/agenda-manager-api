import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateOwnerRequestDto {
  @ApiProperty({
    description:
      'Nome do responsável. Espaços nas pontas são removidos e os internos colapsados; de 1 a 80 caracteres. Único ignorando caixa e acento.',
    example: 'Ana Souza',
    maxLength: 80,
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description:
      'E-mail do responsável (formato simples, até 254 caracteres). Ausente ou em branco significa sem e-mail.',
    example: 'ana.souza@bora.com.br',
    nullable: true,
    type: String,
  })
  @IsOptional()
  @IsString()
  email?: string | null;
}
