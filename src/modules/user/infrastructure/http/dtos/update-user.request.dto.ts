import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

import { Role } from '@/modules/auth/domain/enums/role';

export class UpdateUserRequestDto {
  @ApiPropertyOptional({
    description: 'Novo nome (1 a 120 caracteres). Omitido mantém o atual.',
    example: 'Maria Souza Lima',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description:
      'Novo papel. Omitido mantém o atual. Não vale para a própria conta (`CANNOT_MODIFY_SELF`) nem para o último administrador ativo (`LAST_ADMIN`).',
    enum: Role,
    example: Role.Viewer,
  })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiProperty({
    description:
      'Versão do usuário que o cliente leu. Divergência da atual devolve 409 `USER_VERSION_OUTDATED`',
    example: 1,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  version: number;
}
