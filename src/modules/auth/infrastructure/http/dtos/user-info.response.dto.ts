import { ApiProperty } from '@nestjs/swagger';

import { Permission } from '@/modules/auth/domain/enums/permission';
import { Role } from '@/modules/auth/domain/enums/role';

/** Identidade e permissões do usuário (login, refresh e `GET /auth/user-info`). */
export class UserInfoResponseDto {
  @ApiProperty({
    description: 'Identificador do usuário (claim `sub` do token)',
    example: '0192f6a0-7c1e-7a3b-9d52-4f1e8b6c2a10',
  })
  id: string;

  @ApiProperty({
    description: 'E-mail do usuário',
    example: 'dev.editor@pauta.local',
  })
  email: string;

  @ApiProperty({ description: 'Nome do usuário', example: 'Dev Editor' })
  name: string;

  @ApiProperty({
    description: 'Papel do usuário (um só)',
    enum: Role,
    example: Role.Editor,
  })
  role: Role;

  @ApiProperty({
    description:
      'Permissões resolvidas pela API a partir do papel: fonte única para o front',
    enum: Permission,
    isArray: true,
    example: [Permission.ContentBriefRead, Permission.RegistryRead],
  })
  permissions: Permission[];
}
