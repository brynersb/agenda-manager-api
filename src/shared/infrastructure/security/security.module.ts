import { Global, Module } from '@nestjs/common';

import { PASSWORD_HASHER } from '@/shared/application/interfaces/password-hasher.interface';
import { Argon2PasswordHasher } from '@/shared/infrastructure/security/argon2-password-hasher';

/** Disponibiliza a porta `PasswordHasherInterface` (argon2id) para toda a aplicação. */
@Global()
@Module({
  providers: [{ provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher }],
  exports: [PASSWORD_HASHER],
})
export class SecurityModule {}
