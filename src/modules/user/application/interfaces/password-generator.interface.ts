/** Porta que gera a senha provisória entregue uma única vez a quem administra. */
export interface PasswordGeneratorInterface {
  /** Senha forte, aleatória, que passa na política de senha. */
  generate(): string;
}

export const PASSWORD_GENERATOR = Symbol('PasswordGeneratorInterface');
