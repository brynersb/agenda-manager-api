import { ApiProperty } from '@nestjs/swagger';

import { UserInfoResponseDto } from '@/modules/auth/infrastructure/http/dtos/user-info.response.dto';

/** Resposta de `POST /auth/login` e `POST /auth/refresh`: um novo par de tokens. */
export class AuthSessionResponseDto {
  @ApiProperty({
    description:
      'Access token JWT HS256. Envie em `Authorization: Bearer <accessToken>`',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOi4uLn0.assinatura',
  })
  accessToken: string;

  @ApiProperty({
    description:
      'Refresh token opaco. Vale **uma única vez**: cada renovação devolve um novo e invalida este. Guarde só o mais recente.',
    example: 'q1W2e3R4t5Y6u7I8o9P0aSdFgHjKlZxCvBnM1q2w3e4',
  })
  refreshToken: string;

  @ApiProperty({
    description: 'Validade do access token, em segundos (padrão 900 = 15 min)',
    example: 900,
  })
  expiresIn: number;

  @ApiProperty({
    description:
      'Verdadeiro quando o usuário está com senha provisória e deve trocá-la (`POST /auth/change-password`)',
    example: false,
  })
  mustChangePassword: boolean;

  @ApiProperty({ type: UserInfoResponseDto })
  user: UserInfoResponseDto;
}
