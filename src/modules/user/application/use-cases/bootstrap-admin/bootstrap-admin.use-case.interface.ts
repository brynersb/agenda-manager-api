export type BootstrapAdminInput = {
  /** `BOOTSTRAP_ADMIN_EMAIL`; ausente ou em branco = não configurado. */
  email?: string;
  /** `BOOTSTRAP_ADMIN_PASSWORD`; ausente ou em branco = não configurado. */
  password?: string;
};

/** O que o bootstrap fez: criou o admin, não fez nada (já há usuários) ou faltou configuração. */
export type BootstrapAdminOutcome =
  | 'created'
  | 'users_exist'
  | 'not_configured';

export interface BootstrapAdminUseCaseInterface {
  execute(input: BootstrapAdminInput): Promise<BootstrapAdminOutcome>;
}

export const BOOTSTRAP_ADMIN_USE_CASE = Symbol(
  'BootstrapAdminUseCaseInterface',
);
