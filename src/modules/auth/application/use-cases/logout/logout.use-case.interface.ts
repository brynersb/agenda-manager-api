export type LogoutInput = {
  /** Usuário autenticado que está saindo (do access token). */
  userId: string;
  refreshToken: string;
};

export interface LogoutUseCaseInterface {
  execute(input: LogoutInput): Promise<void>;
}

export const LOGOUT_USE_CASE = Symbol('LogoutUseCaseInterface');
