import type { AuthenticatedUser } from '@/modules/auth/application/types/authenticated-user';
import { permissionsOfRoles } from '@/modules/auth/application/types/role-permissions.map';
import type {
  GetUserInfoQueryInterface,
  UserInfo,
} from './get-user-info.query.interface';

/**
 * Identidade e permissões do usuário autenticado: a fonte única de permissões
 * do front (ADR-003). As permissões saem do mapa papel -> permissão, nunca do
 * que veio no token.
 */
export class GetUserInfoQuery implements GetUserInfoQueryInterface {
  execute(user: AuthenticatedUser): UserInfo {
    return {
      sub: user.sub,
      // O contrato exige `nome` textual; sem claim de nome, cai no e-mail e,
      // por fim, no identificador.
      name: user.name ?? user.email ?? user.sub,
      email: user.email,
      roles: [...user.roles],
      permissions: permissionsOfRoles(user.roles),
    };
  }
}
