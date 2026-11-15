import type { TokenServiceInterface } from '@/modules/auth/application/interfaces/token.service.interface';
import type { AuthSession } from '@/modules/auth/application/types/auth-session';
import { permissionsOfRole } from '@/modules/auth/domain/services/role-permissions';
import type { RefreshTokenRepositoryInterface } from '@/modules/user/application/interfaces/repositories/refresh-token.repository.interface';
import { RefreshTokenDomainEntity } from '@/modules/user/domain/entities/refresh-token.domain-entity';
import type { UserDomainEntity } from '@/modules/user/domain/entities/user.domain-entity';
import type { ClockInterface } from '@/shared/application/interfaces/clock.interface';

/** Metadados da requisição guardados junto do refresh token (auditoria de sessão). */
export type SessionContext = {
  userAgent?: string | null;
  ip?: string | null;
};

const MS_PER_SECOND = 1000;

/**
 * Emite o par de tokens de uma sessão: o access token JWT e um refresh token
 * opaco gravado só como hash. Usado pelo login (família nova) e pelo refresh
 * (rotação dentro da mesma família).
 */
export class SessionIssuer {
  constructor(
    private readonly tokens: TokenServiceInterface,
    private readonly refreshTokens: RefreshTokenRepositoryInterface,
    private readonly clock: ClockInterface,
  ) {}

  /** Login: abre uma família nova de refresh tokens. */
  async open(
    user: UserDomainEntity,
    context: SessionContext,
  ): Promise<AuthSession> {
    const { token, entity } = this.newRefreshToken(user, undefined, context);
    await this.refreshTokens.create(entity);
    return this.toSession(user, token);
  }

  /**
   * Refresh: grava o novo token na família de `current` e revoga `current`
   * atomicamente. `null` quando `current` já tinha sido usado (corrida/reuso).
   */
  async rotate(
    user: UserDomainEntity,
    current: RefreshTokenDomainEntity,
    context: SessionContext,
  ): Promise<AuthSession | null> {
    const { token, entity } = this.newRefreshToken(
      user,
      current.familyId,
      context,
    );
    const rotated = await this.refreshTokens.rotate(
      current.id,
      entity,
      this.clock.now(),
    );
    return rotated ? this.toSession(user, token) : null;
  }

  private newRefreshToken(
    user: UserDomainEntity,
    familyId: string | undefined,
    context: SessionContext,
  ): { token: string; entity: RefreshTokenDomainEntity } {
    const now = this.clock.now();
    const generated = this.tokens.generateRefreshToken();
    const entity = RefreshTokenDomainEntity.issue(
      {
        userId: user.id,
        familyId,
        tokenHash: generated.hash,
        expiresAt: new Date(
          now.getTime() + this.tokens.refreshTtlSeconds * MS_PER_SECOND,
        ),
        userAgent: context.userAgent,
        ip: context.ip,
      },
      now,
    );
    return { token: generated.token, entity };
  }

  private toSession(user: UserDomainEntity, refreshToken: string): AuthSession {
    const access = this.tokens.issueAccessToken({
      id: user.id,
      email: user.email.value,
      name: user.name.value,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    });
    return {
      accessToken: access.token,
      refreshToken,
      expiresIn: access.expiresIn,
      mustChangePassword: user.mustChangePassword,
      user: {
        id: user.id,
        email: user.email.value,
        name: user.name.value,
        role: user.role,
        permissions: permissionsOfRole(user.role),
      },
    };
  }
}
