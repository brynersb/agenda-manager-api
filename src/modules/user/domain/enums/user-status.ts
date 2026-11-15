/**
 * Situação do usuário. Usuário nunca é apagado: `DEACTIVATED` impede login e
 * renovação de sessão, e a conta pode ser reativada.
 */
export enum UserStatus {
  ACTIVE = 'ACTIVE',
  DEACTIVATED = 'DEACTIVATED',
}
