import type { TokenServiceInterface } from '@/modules/auth/application/interfaces/token.service.interface';
import type { AuthSession } from '@/modules/auth/application/types/auth-session';
import type { SessionIssuer } from '@/modules/auth/application/use-cases/common/session-issuer';
import {
  InvalidRefreshTokenError,
  UserDeactivatedError,
} from '@/modules/auth/domain/errors/auth.errors';
import type { RefreshTokenRepositoryInterface } from '@/modules/user/application/interfaces/repositories/refresh-token.repository.interface';
import type { UserRepositoryInterface } from '@/modules/user/application/interfaces/repositories/user.repository.interface';
import type { RefreshTokenDomainEntity } from '@/modules/user/domain/entities/refresh-token.domain-entity';
import type { ClockInterface } from '@/shared/application/interfaces/clock.interface';
import type { LoggerServiceInterface } from '@/shared/application/interfaces/logger.service.interface';
import type {
  RefreshTokenInput,
  RefreshTokenUseCaseInterface,
} from './refresh-token.use-case.interface';

/**
 * Renova a sessão com rotação (ADR-016): cada refresh token vale uma vez. O
 * token usado é revogado e um novo par é emitido na mesma família. Apresentar
 * um token **já revogado** é reuso (provável roubo): a família inteira é
 * revogada e todos os dispositivos dela precisam entrar de novo.
 */
export class RefreshTokenUseCase implements RefreshTokenUseCaseInterface {
  constructor(
    private readonly tokens: TokenServiceInterface,
    private readonly refreshTokens: RefreshTokenRepositoryInterface,
    private readonly users: UserRepositoryInterface,
    private readonly sessions: SessionIssuer,
    private readonly clock: ClockInterface,
    private readonly logger: LoggerServiceInterface,
  ) {
    this.logger.setLogPrefix(RefreshTokenUseCase.name);
  }

  async execute(input: RefreshTokenInput): Promise<AuthSession> {
    const stored = await this.refreshTokens.findByTokenHash(
      this.tokens.hashRefreshToken(input.refreshToken),
    );
    if (!stored) {
      this.recordFailure('unknown_token');
      throw new InvalidRefreshTokenError();
    }

    const now = this.clock.now();
    const status = stored.statusAt(now);
    if (status === 'revoked') {
      await this.revokeFamilyForReuse(stored, now);
      throw new InvalidRefreshTokenError();
    }
    if (status === 'expired') {
      this.recordFailure('expired', stored.userId);
      throw new InvalidRefreshTokenError();
    }

    const user = await this.users.findById(stored.userId);
    if (!user) {
      this.recordFailure('user_not_found', stored.userId);
      throw new InvalidRefreshTokenError();
    }
    if (!user.isActive) {
      await this.refreshTokens.revokeFamily(stored.familyId, now);
      this.logger.warn('Renovação de sessão bloqueada: usuário desativado', {
        'evt.name': 'auth.refresh',
        outcome: 'blocked',
        reason: 'user_deactivated',
        user_id: user.id,
        tags: ['auth', 'security'],
      });
      throw new UserDeactivatedError();
    }

    const session = await this.sessions.rotate(user, stored, {
      userAgent: input.userAgent,
      ip: input.ip,
    });
    if (!session) {
      // Duas renovações simultâneas com o mesmo token: a perdedora é reuso.
      await this.revokeFamilyForReuse(stored, now);
      throw new InvalidRefreshTokenError();
    }

    this.logger.info('Sessão renovada', {
      'evt.name': 'auth.refresh',
      outcome: 'success',
      user_id: user.id,
      tags: ['auth'],
    });
    return session;
  }

  private async revokeFamilyForReuse(
    stored: RefreshTokenDomainEntity,
    now: Date,
  ): Promise<void> {
    await this.refreshTokens.revokeFamily(stored.familyId, now);
    this.logger.warn(
      'Reuso de refresh token detectado: a família de sessões foi revogada',
      {
        'evt.name': 'auth.refresh_token_reuse_detected',
        outcome: 'blocked',
        user_id: stored.userId,
        family_id: stored.familyId,
        tags: ['auth', 'security'],
      },
    );
  }

  private recordFailure(reason: string, userId?: string): void {
    this.logger.warn('Renovação de sessão recusada', {
      'evt.name': 'auth.refresh',
      outcome: 'failure',
      reason,
      user_id: userId,
      tags: ['auth', 'security'],
    });
  }
}
