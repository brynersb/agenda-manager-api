import type { Permission } from '@/modules/auth/domain/enums/permission';
import type { Role } from '@/modules/auth/domain/enums/role';
import type { Actor } from '@/shared/domain/actor';

/** Usuário resolvido pelo `AuthGuard`; é o que `@CurrentUser()` entrega. */
export type AuthenticatedUser = {
  sub: string;
  name: string | null;
  email: string | null;
  roles: Role[];
  permissions: Permission[];
};

/** Quem executa a ação, no formato que os use cases gravam na auditoria. */
export function toActor(user: AuthenticatedUser): Actor {
  return { id: user.sub, name: user.name };
}
