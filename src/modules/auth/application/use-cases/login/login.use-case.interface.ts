import type { AuthSession } from '@/modules/auth/application/types/auth-session';
import type { SessionContext } from '@/modules/auth/application/use-cases/common/session-issuer';

export type LoginInput = SessionContext & {
  email: string;
  password: string;
};

export interface LoginUseCaseInterface {
  execute(input: LoginInput): Promise<AuthSession>;
}

export const LOGIN_USE_CASE = Symbol('LoginUseCaseInterface');
