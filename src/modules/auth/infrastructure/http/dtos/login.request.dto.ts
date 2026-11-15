import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginRequestDto {
  @ApiProperty({
    description: 'E-mail de login (sem diferenciar caixa)',
    example: 'dev.admin@pauta.local',
    maxLength: 254,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  email: string;

  @ApiProperty({
    description: 'Senha do usuário',
    example: '********',
    maxLength: 128,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;
}
