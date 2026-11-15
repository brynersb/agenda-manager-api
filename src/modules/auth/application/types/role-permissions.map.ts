import { Permission } from '@/modules/auth/domain/enums/permission';
import { Role } from '@/modules/auth/domain/enums/role';
import {
  type RolePermissionsMap,
  resolvePermissions,
} from '@/modules/auth/domain/services/resolve-permissions';

/**
 * Mapa papel -> permissões (ADR-003). Fica só na API; o front lê o resultado em
 * `GET /auth/user-info` e nunca reimplementa esta tabela.
 */
export const ROLE_PERMISSIONS: RolePermissionsMap = {
  [Role.Editor]: [
    Permission.ContentBriefRead,
    Permission.ContentBriefWrite,
    Permission.ContentBriefDelete,
    Permission.RegistryRead,
    Permission.RegistryWrite,
  ],
  [Role.Viewer]: [Permission.ContentBriefRead, Permission.RegistryRead],
};

/** Permissões resultantes de um conjunto de papéis, segundo `ROLE_PERMISSIONS`. */
export function permissionsOfRoles(roles: readonly Role[]): Permission[] {
  return resolvePermissions(roles, ROLE_PERMISSIONS);
}
