import type { UserDomainEntity } from '@/modules/user/domain/entities/user.domain-entity';

/** Persistência do agregado `UserDomainEntity` (escrita e buscas por regra). */
export interface UserRepositoryInterface {
  findById(id: string): Promise<UserDomainEntity | null>;

  /** `normalizedEmail` já em minúsculas e sem espaços (`UserEmail.normalize`). Ativos e desativados. */
  findByEmail(normalizedEmail: string): Promise<UserDomainEntity | null>;

  /** Total de usuários em qualquer situação (o bootstrap só cria o admin com zero). */
  count(): Promise<number>;

  /** Administradores ativos, sem contar `userId` (regra do último admin). */
  countActiveAdminsExcluding(userId: string): Promise<number>;

  /**
   * Sem `expectedVersion` insere; com ela atualiza só se a versão gravada for
   * essa. Erros: `UserVersionOutdatedError` (versão), `UserNotFoundError`
   * (sumiu), `EmailAlreadyRegisteredError` (índice único do e-mail, inclusive
   * em corrida) e `LastAdminError` (a gravação deixaria o sistema sem
   * administrador ativo, mesmo com duas requisições simultâneas).
   * Não grava os campos de login (`failedLoginAttempts`, `lockedUntil`,
   * `lastLoginAt`): são de `updateLoginState`, com exceção de o domínio limpar
   * o bloqueio em `changePassword`, `resetPassword` e `reactivate`, que `save`
   * grava.
   */
  save(user: UserDomainEntity, expectedVersion?: number): Promise<void>;

  /**
   * Muda só o estado de login (contador de falhas, bloqueio e último login) de
   * forma atômica: lê a linha com trava, aplica `mutate` (um método do
   * domínio) e grava sem mexer em `version` nem na auditoria. A trava impede
   * que tentativas simultâneas escapem da contagem do bloqueio. Devolve o
   * usuário já alterado, ou `null` se ele não existe mais.
   */
  updateLoginState(
    id: string,
    mutate: (user: UserDomainEntity) => void,
  ): Promise<UserDomainEntity | null>;
}

export const USER_REPOSITORY = Symbol('UserRepositoryInterface');
