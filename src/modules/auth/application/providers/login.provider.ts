import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '@/config/env.validation';
import {
  TOKEN_SERVICE,
  type TokenServiceInterface,
} from '@/modules/auth/application/interfaces/token.service.interface';
import { SessionIssuer } from '@/modules/auth/application/use-cases/common/session-issuer';
import { LoginUseCase } from '@/modules/auth/application/use-cases/login/login.use-case';
import {
  LOGIN_USE_CASE,
  type LoginUseCaseInterface,
} from '@/modules/auth/application/use-cases/login/login.use-case.interface';
import {
  REFRESH_TOKEN_REPOSITORY,
  type RefreshTokenRepositoryInterface,
} from '@/modules/user/application/interfaces/repositories/refresh-token.repository.interface';
import {
  USER_REPOSITORY,
  type UserRepositoryInterface,
} from '@/modules/user/application/interfaces/repositories/user.repository.interface';
import {
  CLOCK,
  type ClockInterface,
} from '@/shared/application/interfaces/clock.interface';
import {
  LOGGER_SERVICE,
  type LoggerServiceInterface,
} from '@/shared/application/interfaces/logger.service.interface';
import {
  PASSWORD_HASHER,
  type PasswordHasherInterface,
} from '@/shared/application/interfaces/password-hasher.interface';

export const LoginProvider: Provider = {
  provide: LOGIN_USE_CASE,
  inject: [
    USER_REPOSITORY,
    PASSWORD_HASHER,
    TOKEN_SERVICE,
    REFRESH_TOKEN_REPOSITORY,
    CLOCK,
    LOGGER_SERVICE,
    ConfigService,
  ],
  useFactory: (
    users: UserRepositoryInterface,
    hasher: PasswordHasherInterface,
    tokens: TokenServiceInterface,
    refreshTokens: RefreshTokenRepositoryInterface,
    clock: ClockInterface,
    logger: LoggerServiceInterface,
    config: ConfigService<Env, true>,
  ): LoginUseCaseInterface =>
    new LoginUseCase(
      users,
      hasher,
      new SessionIssuer(tokens, refreshTokens, clock),
      clock,
      {
        maxAttempts: config.get('LOGIN_MAX_ATTEMPTS', { infer: true }),
        lockMinutes: config.get('LOGIN_LOCK_MINUTES', { infer: true }),
      },
      logger,
    ),
};
