import type { Permission } from '@/modules/auth/domain/enums/permission';
import type { Role } from '@/modules/auth/domain/enums/role';
import type { Actor } from '@/shared/domain/actor';

/**
 * Usuário resolvido pelo `AuthGuard` a partir das claims do access token (sem
 * ir ao banco); é o que `@CurrentUser()` entrega. As `permissions` são
 * derivadas do `role` no servidor, nunca lidas do token.
 */
export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  permissions: Permission[];
};

/** Quem executa a ação, no formato que os use cases gravam na auditoria. */
export function toActor(user: AuthenticatedUser): Actor {
  return { id: user.id, name: user.name };
}
