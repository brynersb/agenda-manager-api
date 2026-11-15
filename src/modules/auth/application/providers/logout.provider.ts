import type { Provider } from '@nestjs/common';

import {
  TOKEN_SERVICE,
  type TokenServiceInterface,
} from '@/modules/auth/application/interfaces/token.service.interface';
import { LogoutUseCase } from '@/modules/auth/application/use-cases/logout/logout.use-case';
import {
  LOGOUT_USE_CASE,
  type LogoutUseCaseInterface,
} from '@/modules/auth/application/use-cases/logout/logout.use-case.interface';
import {
  REFRESH_TOKEN_REPOSITORY,
  type RefreshTokenRepositoryInterface,
} from '@/modules/user/application/interfaces/repositories/refresh-token.repository.interface';
import {
  CLOCK,
  type ClockInterface,
} from '@/shared/application/interfaces/clock.interface';
import {
  LOGGER_SERVICE,
  type LoggerServiceInterface,
} from '@/shared/application/interfaces/logger.service.interface';

export const LogoutProvider: Provider = {
  provide: LOGOUT_USE_CASE,
  inject: [TOKEN_SERVICE, REFRESH_TOKEN_REPOSITORY, CLOCK, LOGGER_SERVICE],
  useFactory: (
    tokens: TokenServiceInterface,
    refreshTokens: RefreshTokenRepositoryInterface,
    clock: ClockInterface,
    logger: LoggerServiceInterface,
  ): LogoutUseCaseInterface =>
    new LogoutUseCase(tokens, refreshTokens, clock, logger),
};
