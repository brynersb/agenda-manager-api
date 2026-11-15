import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwksClient } from 'jwks-rsa';

import type { Env } from '@/config/env.validation';
import { OIDC_TOKEN_SERVICE } from '@/modules/auth/application/interfaces/token-verifier.interface';
import { GetUserInfoProvider } from '@/modules/auth/application/providers/get-user-info.provider';
import { AuthController } from '@/modules/auth/infrastructure/http/controllers/auth.controller';
import { OidcTokenService } from '@/modules/auth/infrastructure/services/oidc-token.service';

/** Cache das chaves públicas do Keycloak (ADR-003). */
const JWKS_CACHE_MS = 10 * 60 * 1000;
const JWKS_REQUESTS_PER_MINUTE = 10;

function csv(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Autenticação e autorização. Os guards (`AuthGuard`, `PermissionsGuard`) são
 * registrados como `APP_GUARD` no `AppModule`, depois do `ThrottlerGuard`, e
 * dependem do `OIDC_TOKEN_SERVICE` exportado aqui.
 */
@Module({
  controllers: [AuthController],
  providers: [
    {
      provide: OIDC_TOKEN_SERVICE,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const issuer = (
          config.get('OIDC_ISSUER_URL', { infer: true }) ?? ''
        ).replace(/\/+$/, '');
        const jwksUri =
          config.get('OIDC_JWKS_URI', { infer: true }) ||
          `${issuer}/protocol/openid-connect/certs`;
        return new OidcTokenService(
          {
            issuer,
            audiences: csv(config.get('OIDC_AUDIENCE', { infer: true })),
            rolesClaim: config.get('OIDC_ROLES_CLAIM', { infer: true }),
          },
          new JwksClient({
            jwksUri,
            cache: true,
            cacheMaxAge: JWKS_CACHE_MS,
            rateLimit: true,
            jwksRequestsPerMinute: JWKS_REQUESTS_PER_MINUTE,
          }),
        );
      },
    },
    GetUserInfoProvider,
  ],
  exports: [OIDC_TOKEN_SERVICE],
})
export class AuthModule {}
