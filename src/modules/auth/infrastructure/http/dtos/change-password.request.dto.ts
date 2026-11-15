import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ChangePasswordRequestDto {
  @ApiProperty({ description: 'Senha atual', maxLength: 128 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  currentPassword: string;

  @ApiProperty({
    description:
      'Nova senha (10 a 128 caracteres, diferente da atual). A política é conferida pela API (`WEAK_PASSWORD`).',
    minLength: 10,
    maxLength: 256,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  newPassword: string;
}
