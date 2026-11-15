import { ApiProperty } from '@nestjs/swagger';

import { Role } from '@/modules/auth/domain/enums/role';
import { UserStatus } from '@/modules/user/domain/enums/user-status';
import { pageResponseDto } from '@/shared/infrastructure/http/pagination/page.response';

/** Quem criou ou alterou o usuário por último. */
export class UserAuthorResponseDto {
  @ApiProperty({
    description:
      'Identificador de quem agiu (uuid do usuário, ou `bootstrap`/`seed`)',
    example: '0192f6a0-7c1e-7a3b-9d52-4f1e8b6c2a10',
  })
  id: string;

  @ApiProperty({
    description: 'Nome no momento da gravação (snapshot)',
    example: 'Administrador',
    nullable: true,
    type: String,
  })
  name: string | null;
}

/** Usuário como a API o devolve. Nunca inclui hash de senha nem token. */
export class UserResponseDto {
  @ApiProperty({
    description: 'Identificador (uuid v7)',
    example: '0192f6a0-7c1e-7a3b-9d52-4f1e8b6c2a10',
  })
  id: string;

  @ApiProperty({ description: 'Nome de exibição', example: 'Maria Souza' })
  name: string;

  @ApiProperty({
    description: 'E-mail de login, em minúsculas',
    example: 'maria.souza@bora.com.br',
  })
  email: string;

  @ApiProperty({ enum: Role, example: Role.Editor })
  role: Role;

  @ApiProperty({
    description: '`DEACTIVATED` impede login e renovação de sessão',
    enum: UserStatus,
    enumName: 'UserStatus',
    example: UserStatus.ACTIVE,
  })
  status: UserStatus;

  @ApiProperty({
    description:
      'Verdadeiro enquanto o usuário usa uma senha provisória e precisa trocá-la',
    example: false,
  })
  mustChangePassword: boolean;

  @ApiProperty({
    description:
      'Fim do bloqueio por excesso de tentativas de login. Só está bloqueado se a data ainda está no futuro; passada, a conta já destravou.',
    example: null,
    nullable: true,
    type: String,
    format: 'date-time',
  })
  lockedUntil: string | null;

  @ApiProperty({
    description: 'Último login com sucesso (ISO-8601 UTC)',
    example: '2026-11-14T12:00:00.000Z',
    nullable: true,
    type: String,
    format: 'date-time',
  })
  lastLoginAt: string | null;

  @ApiProperty({
    description:
      'Versão para concorrência otimista; envie-a de volta em `PATCH /users/:id`',
    example: 1,
  })
  version: number;

  @ApiProperty({ example: '2026-11-14T12:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ type: UserAuthorResponseDto })
  createdBy: UserAuthorResponseDto;

  @ApiProperty({ example: '2026-11-14T12:00:00.000Z' })
  updatedAt: string;

  @ApiProperty({ type: UserAuthorResponseDto })
  updatedBy: UserAuthorResponseDto;
}

/** Página de usuários: `{ data, total, page, limit }`. */
export class ListUsersResponseDto extends pageResponseDto(UserResponseDto) {}

/** Resposta de criação e de redefinição de senha: traz a senha provisória uma única vez. */
export class UserWithTemporaryPasswordResponseDto {
  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;

  @ApiProperty({
    description:
      'Senha provisória **gerada pela API**, devolvida só nesta resposta (nunca mais recuperável; repasse por canal seguro). `null` quando o administrador informou a senha ao criar.',
    example: 'Vq7#kT9m-Rw2xPz4',
    nullable: true,
    type: String,
  })
  temporaryPassword: string | null;
}
