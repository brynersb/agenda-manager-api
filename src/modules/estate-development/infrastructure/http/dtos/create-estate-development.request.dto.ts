import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateEstateDevelopmentRequestDto {
  @ApiProperty({
    description:
      'Nome do empreendimento. Espaços nas pontas são removidos e os internos colapsados; de 1 a 80 caracteres. Único ignorando caixa e acento.',
    example: 'Residencial Ipê',
    maxLength: 80,
  })
  @IsString()
  name: string;
}
