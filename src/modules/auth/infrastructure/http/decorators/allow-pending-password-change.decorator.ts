import { SetMetadata } from '@nestjs/common';

export const ALLOW_PENDING_PASSWORD_CHANGE_KEY =
  'auth:allowPendingPasswordChange';

/**
 * Libera a rota para o token com senha provisória pendente (claim `mcp`). Sem
 * ele, o `AuthGuard` nega com 403 `PASSWORD_CHANGE_REQUIRED`. Só a troca de
 * senha, o logout e `GET /auth/user-info` o usam.
 */
export const AllowPendingPasswordChange = () =>
  SetMetadata(ALLOW_PENDING_PASSWORD_CHANGE_KEY, true);
