import type { AuthSession } from '@/modules/auth/application/types/auth-session';
import type { SessionContext } from '@/modules/auth/application/use-cases/common/session-issuer';

export type ChangePasswordInput = SessionContext & {
  /** Usuário autenticado (do access token). */
  userId: string;
  currentPassword: string;
  newPassword: string;
};

export interface ChangePasswordUseCaseInterface {
  /** Devolve a sessão nova (sem `mcp`): a troca revoga todos os refresh tokens. */
  execute(input: ChangePasswordInput): Promise<AuthSession>;
}

export const CHANGE_PASSWORD_USE_CASE = Symbol(
  'ChangePasswordUseCaseInterface',
);
