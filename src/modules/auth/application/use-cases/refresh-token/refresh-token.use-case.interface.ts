import type { AuthSession } from '@/modules/auth/application/types/auth-session';
import type { SessionContext } from '@/modules/auth/application/use-cases/common/session-issuer';

export type RefreshTokenInput = SessionContext & {
  refreshToken: string;
};

export interface RefreshTokenUseCaseInterface {
  execute(input: RefreshTokenInput): Promise<AuthSession>;
}

export const REFRESH_TOKEN_USE_CASE = Symbol('RefreshTokenUseCaseInterface');
