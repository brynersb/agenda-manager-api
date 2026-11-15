import { randomBytes } from 'node:crypto';

import * as argon2 from 'argon2';

import type { PasswordHasherInterface } from '@/shared/application/interfaces/password-hasher.interface';

/**
 * Parâmetros do argon2id: a primeira configuração recomendada pela OWASP
 * (19 MiB de memória, 2 iterações, 1 de paralelismo). O custo fica embutido
 * no hash gerado, então trocar estes valores não invalida senhas existentes.
 */
const OPTIONS: argon2.HashOptions = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

/** Hash de senha com argon2id (pacote `argon2`, binding nativo). */
export class Argon2PasswordHasher implements PasswordHasherInterface {
  private dummyHash?: Promise<string>;

  hash(plain: string): Promise<string> {
    return argon2.hash(plain, OPTIONS);
  }

  async verify(plain: string, hash: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      // Hash malformado ou de outro algoritmo: nunca confere.
      return false;
    }
  }

  async burnVerification(plain: string): Promise<void> {
    this.dummyHash ??= this.hash(randomBytes(24).toString('base64url'));
    await this.verify(plain, await this.dummyHash);
  }
}
