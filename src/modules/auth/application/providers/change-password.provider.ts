import type { Provider } from '@nestjs/common';

import {
  TOKEN_SERVICE,
  type TokenServiceInterface,
} from '@/modules/auth/application/interfaces/token.service.interface';
import { ChangePasswordUseCase } from '@/modules/auth/application/use-cases/change-password/change-password.use-case';
import {
  CHANGE_PASSWORD_USE_CASE,
  type ChangePasswordUseCaseInterface,
} from '@/modules/auth/application/use-cases/change-password/change-password.use-case.interface';
import { SessionIssuer } from '@/modules/auth/application/use-cases/common/session-issuer';
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

export const ChangePasswordProvider: Provider = {
  provide: CHANGE_PASSWORD_USE_CASE,
  inject: [
    USER_REPOSITORY,
    REFRESH_TOKEN_REPOSITORY,
    PASSWORD_HASHER,
    TOKEN_SERVICE,
    CLOCK,
    LOGGER_SERVICE,
  ],
  useFactory: (
    users: UserRepositoryInterface,
    refreshTokens: RefreshTokenRepositoryInterface,
    hasher: PasswordHasherInterface,
    tokens: TokenServiceInterface,
    clock: ClockInterface,
    logger: LoggerServiceInterface,
  ): ChangePasswordUseCaseInterface =>
    new ChangePasswordUseCase(
      users,
      refreshTokens,
      hasher,
      new SessionIssuer(tokens, refreshTokens, clock),
      clock,
      logger,
    ),
};
