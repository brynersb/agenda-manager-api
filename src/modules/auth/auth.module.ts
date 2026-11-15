import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { parseDurationToSeconds } from '@/config/duration';
import type { Env } from '@/config/env.validation';
import { TOKEN_SERVICE } from '@/modules/auth/application/interfaces/token.service.interface';
import { ChangePasswordProvider } from '@/modules/auth/application/providers/change-password.provider';
import { GetUserInfoProvider } from '@/modules/auth/application/providers/get-user-info.provider';
import { LoginProvider } from '@/modules/auth/application/providers/login.provider';
import { LogoutProvider } from '@/modules/auth/application/providers/logout.provider';
import { RefreshTokenProvider } from '@/modules/auth/application/providers/refresh-token.provider';
import { AuthController } from '@/modules/auth/infrastructure/http/controllers/auth.controller';
import { TokenService } from '@/modules/auth/infrastructure/services/token.service';
import { UserModule } from '@/modules/user/user.module';

/**
 * Autenticação própria (ADR-016): login, refresh com rotação, logout, troca de
 * senha e `user-info`. Importa o `UserModule` para ler e gravar usuários e
 * refresh tokens pelas portas dele. Os guards (`AuthGuard`, `PermissionsGuard`)
 * são registrados como `APP_GUARD` no `AppModule`, depois do `ThrottlerGuard`, e
 * dependem do `TOKEN_SERVICE` exportado aqui.
 */
@Module({
  imports: [UserModule],
  controllers: [AuthController],
  providers: [
    {
      provide: TOKEN_SERVICE,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new TokenService({
          secret: config.get('JWT_SECRET', { infer: true }),
          issuer: config.get('JWT_ISSUER', { infer: true }),
          audience: config.get('JWT_AUDIENCE', { infer: true }),
          accessTtlSeconds: parseDurationToSeconds(
            config.get('JWT_ACCESS_TTL', { infer: true }),
          ),
          refreshTtlSeconds: parseDurationToSeconds(
            config.get('JWT_REFRESH_TTL', { infer: true }),
          ),
        }),
    },
    GetUserInfoProvider,
    LoginProvider,
    RefreshTokenProvider,
    LogoutProvider,
    ChangePasswordProvider,
  ],
  exports: [TOKEN_SERVICE],
})
export class AuthModule {}
