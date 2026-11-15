import { ApiProperty } from '@nestjs/swagger';

import { Permission } from '@/modules/auth/domain/enums/permission';
import { Role } from '@/modules/auth/domain/enums/role';

export class UserInfoResponseDto {
  @ApiProperty({
    description: 'Identificador do usuário (claim `sub` do token)',
    example: '3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
  })
  sub: string;

  @ApiProperty({
    description:
      'Nome do usuário (claim `name` ou `preferred_username`; na falta, e-mail ou `sub`)',
    example: 'Dev Editor',
  })
  name: string;

  @ApiProperty({
    description: 'E-mail do usuário, quando o token traz a claim `email`',
    example: 'dev.editor@bora.local',
    nullable: true,
    type: String,
  })
  email: string | null;

  @ApiProperty({
    description:
      'Papéis `content-brief-*` do usuário. Vazio quando ele não tem nenhum (o front manda para /sem-permissao)',
    enum: Role,
    isArray: true,
    example: [Role.Editor],
  })
  roles: Role[];

  @ApiProperty({
    description:
      'Permissões resolvidas pela API a partir dos papéis: fonte única para o front',
    enum: Permission,
    isArray: true,
    example: [Permission.ContentBriefRead, Permission.RegistryRead],
  })
  permissions: Permission[];
}
