import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Corpo de `POST /auth/refresh` e de `POST /auth/logout`. */
export class RefreshTokenRequestDto {
  @ApiProperty({
    description:
      'Refresh token opaco recebido no login ou na última renovação (vale uma única vez)',
    example: 'q1W2e3R4t5Y6u7I8o9P0aSdFgHjKlZxCvBnM1q2w3e4',
    maxLength: 512,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  refreshToken: string;
}
