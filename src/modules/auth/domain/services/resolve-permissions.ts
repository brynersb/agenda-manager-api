import { Permission } from '@/modules/auth/domain/enums/permission';
import type { Role } from '@/modules/auth/domain/enums/role';

export type RolePermissionsMap = Readonly<Record<Role, readonly Permission[]>>;

/**
 * Une as permissões de todos os papéis, sem repetição e na ordem do enum
 * `Permission` (saída estável, independente da ordem dos papéis).
 */
export function resolvePermissions(
  roles: readonly Role[],
  map: RolePermissionsMap,
): Permission[] {
  const granted = new Set<Permission>();
  for (const role of roles) {
    for (const permission of map[role] ?? []) {
      granted.add(permission);
    }
  }
  return Object.values(Permission).filter((permission) =>
    granted.has(permission),
  );
}
