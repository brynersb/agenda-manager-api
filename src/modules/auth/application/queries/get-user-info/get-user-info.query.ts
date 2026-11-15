import type { UserInfo } from '@/modules/auth/application/types/auth-session';
import type { AuthenticatedUser } from '@/modules/auth/application/types/authenticated-user';
import { permissionsOfRole } from '@/modules/auth/domain/services/role-permissions';
import type { GetUserInfoQueryInterface } from './get-user-info.query.interface';

/**
 * Identidade e permissões do usuário autenticado: a fonte única de permissões
 * do front (ADR-003). Lê só o que o `AuthGuard` já resolveu das claims do
 * token, sem ir ao banco; as permissões saem do mapa papel -> permissão, nunca
 * do que veio no objeto.
 */
export class GetUserInfoQuery implements GetUserInfoQueryInterface {
  execute(user: AuthenticatedUser): UserInfo {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: permissionsOfRole(user.role),
    };
  }
}
