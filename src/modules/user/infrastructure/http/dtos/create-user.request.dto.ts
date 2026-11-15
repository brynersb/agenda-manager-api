import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

import { Role } from '@/modules/auth/domain/enums/role';

export class CreateUserRequestDto {
  @ApiProperty({
    description:
      'Nome de exibição (1 a 120 caracteres após normalizar espaços)',
    example: 'Maria Souza',
    maxLength: 120,
  })
  @IsString()
  name: string;

  @ApiProperty({
    description:
      'E-mail de login (até 254 caracteres). Gravado em minúsculas; único ignorando caixa, inclusive entre desativados.',
    example: 'maria.souza@bora.com.br',
    maxLength: 254,
  })
  @IsString()
  email: string;

  @ApiProperty({
    description: 'Papel do usuário (um só)',
    enum: Role,
    example: Role.Editor,
  })
  @IsEnum(Role)
  role: Role;

  @ApiPropertyOptional({
    description:
      'Senha inicial (10 a 128 caracteres). Omitida, a API gera uma senha provisória forte e a devolve uma única vez na resposta. Em qualquer caso o usuário é obrigado a trocá-la no primeiro login.',
    minLength: 10,
    maxLength: 128,
  })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  password?: string;
}
