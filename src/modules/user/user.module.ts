import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PASSWORD_GENERATOR } from '@/modules/user/application/interfaces/password-generator.interface';
import { REFRESH_TOKEN_REPOSITORY } from '@/modules/user/application/interfaces/repositories/refresh-token.repository.interface';
import { USER_REPOSITORY } from '@/modules/user/application/interfaces/repositories/user.repository.interface';
import { USER_QUERY_REPOSITORY } from '@/modules/user/application/interfaces/repositories/user-query.repository.interface';
import { BootstrapAdminProvider } from '@/modules/user/application/providers/bootstrap-admin.provider';
import { CreateUserProvider } from '@/modules/user/application/providers/create-user.provider';
import { DeactivateUserProvider } from '@/modules/user/application/providers/deactivate-user.provider';
import { FindUserByIdProvider } from '@/modules/user/application/providers/find-user-by-id.provider';
import { ListUsersProvider } from '@/modules/user/application/providers/list-users.provider';
import { ReactivateUserProvider } from '@/modules/user/application/providers/reactivate-user.provider';
import { ResetUserPasswordProvider } from '@/modules/user/application/providers/reset-user-password.provider';
import { UpdateUserProvider } from '@/modules/user/application/providers/update-user.provider';
import { AdminBootstrapService } from '@/modules/user/infrastructure/bootstrap/admin-bootstrap.service';
import { UserController } from '@/modules/user/infrastructure/http/controllers/user.controller';
import { RefreshTokenEntity } from '@/modules/user/infrastructure/persistence/entities/refresh-token.entity';
import { UserEntity } from '@/modules/user/infrastructure/persistence/entities/user.entity';
import { RefreshTokenRepository } from '@/modules/user/infrastructure/persistence/repositories/refresh-token/refresh-token.repository';
import { UserRepository } from '@/modules/user/infrastructure/persistence/repositories/user/user.repository';
import { UserQueryRepository } from '@/modules/user/infrastructure/persistence/repositories/user/user-query.repository';
import { CryptoPasswordGenerator } from '@/modules/user/infrastructure/services/crypto-password-generator';

/**
 * Administração de usuários (`/api/v1/users`) e a persistência de identidade:
 * as tabelas `users` e `refresh_tokens`. O `AuthModule` importa este módulo e
 * usa as portas exportadas (ADR-016): é a única exceção à regra de módulos de
 * negócio independentes, porque autenticar é ler e atualizar usuários.
 */
@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, RefreshTokenEntity])],
  controllers: [UserController],
  providers: [
    { provide: USER_REPOSITORY, useClass: UserRepository },
    { provide: USER_QUERY_REPOSITORY, useClass: UserQueryRepository },
    { provide: REFRESH_TOKEN_REPOSITORY, useClass: RefreshTokenRepository },
    { provide: PASSWORD_GENERATOR, useClass: CryptoPasswordGenerator },
    CreateUserProvider,
    UpdateUserProvider,
    DeactivateUserProvider,
    ReactivateUserProvider,
    ResetUserPasswordProvider,
    ListUsersProvider,
    FindUserByIdProvider,
    BootstrapAdminProvider,
    AdminBootstrapService,
  ],
  exports: [USER_REPOSITORY, REFRESH_TOKEN_REPOSITORY],
})
export class UserModule {}
