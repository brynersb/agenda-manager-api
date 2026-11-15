import type { Request } from 'express';

import type { AuthenticatedUser } from '@/modules/auth/application/types/authenticated-user';

/** Request do Express com o usuário que o `AuthGuard` resolveu. */
export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}
