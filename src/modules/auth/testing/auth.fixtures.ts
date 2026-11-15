import type { TokenServiceInterface } from '@/modules/auth/application/interfaces/token.service.interface';
import { SessionIssuer } from '@/modules/auth/application/use-cases/common/session-issuer';
import { RefreshTokenDomainEntity } from '@/modules/user/domain/entities/refresh-token.domain-entity';
import {
  type fakeRefreshTokenRepository,
  NOW,
} from '@/modules/user/testing/user.fixtures';
import type { ClockInterface } from '@/shared/application/interfaces/clock.interface';

/** Fixtures só para specs dos casos de uso de autenticação. */

export const REFRESH_TTL_SECONDS = 7 * 24 * 3600;

/** Serviço de token determinístico: o hash de `t` é `hash-of-t`. */
export function fakeTokenService() {
  // O número do token é a contagem de chamadas: `vi.clearAllMocks()` o reinicia.
  const generateRefreshToken = vi.fn(() => {
    const token = `refresh-${generateRefreshToken.mock.calls.length}`;
    return { token, hash: `hash-of-${token}` };
  });
  return {
    refreshTtlSeconds: REFRESH_TTL_SECONDS,
    issueAccessToken: vi.fn((subject: { id: string }) => ({
      token: `access-for-${subject.id}`,
      expiresIn: 900,
    })),
    verifyAccessToken: vi.fn(),
    generateRefreshToken,
    hashRefreshToken: vi.fn((token: string) => `hash-of-${token}`),
  } satisfies TokenServiceInterface;
}

export function makeSessionIssuer(
  tokens: TokenServiceInterface,
  refreshTokens: ReturnType<typeof fakeRefreshTokenRepository>,
  clock: ClockInterface,
): SessionIssuer {
  return new SessionIssuer(tokens, refreshTokens, clock);
}

/** Refresh token reidratado, utilizável por padrão. */
export function makeRefreshToken(
  overrides: Partial<{
    id: string;
    userId: string;
    familyId: string;
    expiresAt: Date;
    revokedAt: Date | null;
  }> = {},
): RefreshTokenDomainEntity {
  return RefreshTokenDomainEntity.restore({
    id: overrides.id ?? 'rt-1',
    userId: overrides.userId ?? 'user-1',
    familyId: overrides.familyId ?? 'family-1',
    tokenHash: 'hash-of-refresh-antigo',
    expiresAt:
      overrides.expiresAt ??
      new Date(NOW.getTime() + REFRESH_TTL_SECONDS * 1000),
    revokedAt: overrides.revokedAt ?? null,
    replacedById: null,
    createdAt: new Date(NOW.getTime() - 3600_000),
    userAgent: null,
    ip: null,
  });
}
