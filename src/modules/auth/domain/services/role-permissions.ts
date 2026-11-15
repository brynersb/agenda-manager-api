import { Permission } from '@/modules/auth/domain/enums/permission';
import { Role } from '@/modules/auth/domain/enums/role';

export type RolePermissionsMap = Readonly<Record<Role, readonly Permission[]>>;

/**
 * Mapa papel -> permissões (ADR-003, ADR-016): a única fonte da decisão de
 * acesso. Fica só na API; o front lê o resultado no login e em
 * `GET /auth/user-info` e nunca reimplementa esta tabela. `admin` tem todas;
 * editor e leitor não têm `user:*`.
 */
export const ROLE_PERMISSIONS: RolePermissionsMap = {
  [Role.Admin]: Object.values(Permission),
  [Role.Editor]: [
    Permission.ContentBriefRead,
    Permission.ContentBriefWrite,
    Permission.ContentBriefDelete,
    Permission.RegistryRead,
    Permission.RegistryWrite,
  ],
  [Role.Viewer]: [Permission.ContentBriefRead, Permission.RegistryRead],
};

/**
 * Permissões de um papel, sem repetição e na ordem do enum `Permission`
 * (saída estável). Papel desconhecido não ganha nada.
 */
export function permissionsOfRole(
  role: Role,
  map: RolePermissionsMap = ROLE_PERMISSIONS,
): Permission[] {
  const granted = new Set<Permission>(map[role] ?? []);
  return Object.values(Permission).filter((permission) =>
    granted.has(permission),
  );
}
