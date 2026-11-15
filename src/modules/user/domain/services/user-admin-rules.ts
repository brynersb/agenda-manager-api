import type { UserDomainEntity } from '@/modules/user/domain/entities/user.domain-entity';
import {
  CannotModifySelfError,
  LastAdminError,
} from '@/modules/user/domain/errors/user.errors';

/**
 * Quem age não pode desativar nem rebaixar a própria conta. Lança
 * `CANNOT_MODIFY_SELF`.
 */
export function assertNotSelf(actorId: string, target: UserDomainEntity): void {
  if (actorId === target.id) {
    throw new CannotModifySelfError();
  }
}

/**
 * Antes de tirar o status de administrador ativo de `target` (desativar ou
 * mudar o papel), garante que sobra outro administrador ativo.
 * `otherActiveAdmins` é a contagem **sem** `target`. Alvo que não é
 * administrador ativo não é afetado pela regra. Lança `LAST_ADMIN`.
 */
export function assertNotLastActiveAdmin(
  target: UserDomainEntity,
  otherActiveAdmins: number,
): void {
  if (target.isActiveAdmin && otherActiveAdmins < 1) {
    throw new LastAdminError();
  }
}
