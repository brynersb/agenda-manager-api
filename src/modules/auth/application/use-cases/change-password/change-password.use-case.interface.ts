export type ChangePasswordInput = {
  /** Usuário autenticado (do access token). */
  userId: string;
  currentPassword: string;
  newPassword: string;
};

export interface ChangePasswordUseCaseInterface {
  execute(input: ChangePasswordInput): Promise<void>;
}

export const CHANGE_PASSWORD_USE_CASE = Symbol(
  'ChangePasswordUseCaseInterface',
);
