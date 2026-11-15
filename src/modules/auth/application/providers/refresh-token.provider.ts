import type { Provider } from '@nestjs/common';

import {
  TOKEN_SERVICE,
  type TokenServiceInterface,
} from '@/modules/auth/application/interfaces/token.service.interface';
import { SessionIssuer } from '@/modules/auth/application/use-cases/common/session-issuer';
import { RefreshTokenUseCase } from '@/modules/auth/application/use-cases/refresh-token/refresh-token.use-case';
import {
  REFRESH_TOKEN_USE_CASE,
  type RefreshTokenUseCaseInterface,
} from '@/modules/auth/application/use-cases/refresh-token/refresh-token.use-case.interface';
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

export const RefreshTokenProvider: Provider = {
  provide: REFRESH_TOKEN_USE_CASE,
  inject: [
    TOKEN_SERVICE,
    REFRESH_TOKEN_REPOSITORY,
    USER_REPOSITORY,
    CLOCK,
    LOGGER_SERVICE,
  ],
  useFactory: (
    tokens: TokenServiceInterface,
    refreshTokens: RefreshTokenRepositoryInterface,
    users: UserRepositoryInterface,
    clock: ClockInterface,
    logger: LoggerServiceInterface,
  ): RefreshTokenUseCaseInterface =>
    new RefreshTokenUseCase(
      tokens,
      refreshTokens,
      users,
      new SessionIssuer(tokens, refreshTokens, clock),
      clock,
      logger,
    ),
};
