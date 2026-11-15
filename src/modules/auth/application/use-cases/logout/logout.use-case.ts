import type { TokenServiceInterface } from '@/modules/auth/application/interfaces/token.service.interface';
import type { RefreshTokenRepositoryInterface } from '@/modules/user/application/interfaces/repositories/refresh-token.repository.interface';
import type { ClockInterface } from '@/shared/application/interfaces/clock.interface';
import type { LoggerServiceInterface } from '@/shared/application/interfaces/logger.service.interface';
import type {
  LogoutInput,
  LogoutUseCaseInterface,
} from './logout.use-case.interface';

/**
 * Encerra a sessão revogando a família do refresh token. Idempotente e sem
 * vazar nada: token desconhecido, já revogado ou de outro usuário termina em
 * silêncio (o chamador responde 204 de qualquer jeito).
 */
export class LogoutUseCase implements LogoutUseCaseInterface {
  constructor(
    private readonly tokens: TokenServiceInterface,
    private readonly refreshTokens: RefreshTokenRepositoryInterface,
    private readonly clock: ClockInterface,
    private readonly logger: LoggerServiceInterface,
  ) {
    this.logger.setLogPrefix(LogoutUseCase.name);
  }

  async execute(input: LogoutInput): Promise<void> {
    const stored = await this.refreshTokens.findByTokenHash(
      this.tokens.hashRefreshToken(input.refreshToken),
    );
    // Só revoga a família do próprio usuário: o access token de A não derruba a sessão de B.
    if (!stored || stored.userId !== input.userId) {
      return;
    }

    await this.refreshTokens.revokeFamily(stored.familyId, this.clock.now());
    this.logger.info('Logout realizado', {
      'evt.name': 'auth.logout',
      outcome: 'success',
      user_id: input.userId,
      tags: ['auth'],
    });
  }
}
