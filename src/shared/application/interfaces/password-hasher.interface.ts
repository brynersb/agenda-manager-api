/**
 * Porta de hash de senha. A implementação (argon2id) fica em
 * `shared/infrastructure/security`; os casos de uso só conhecem esta interface.
 */
export interface PasswordHasherInterface {
  /** Hash com sal próprio; nunca devolve a senha. */
  hash(plain: string): Promise<string>;

  /** Compara em tempo constante. Hash malformado vira `false` (não lança). */
  verify(plain: string, hash: string): Promise<boolean>;

  /**
   * Gasta o mesmo tempo de uma verificação real, contra um hash descartável.
   * O login chama quando o e-mail não existe, para o tempo de resposta não
   * revelar quais e-mails estão cadastrados.
   */
  burnVerification(plain: string): Promise<void>;
}

export const PASSWORD_HASHER = Symbol('PasswordHasherInterface');
