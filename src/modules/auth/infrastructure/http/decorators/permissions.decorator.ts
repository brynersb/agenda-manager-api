import { SetMetadata } from '@nestjs/common';

import type { Permission } from '@/modules/auth/domain/enums/permission';

export const PERMISSIONS_KEY = 'auth:permissions';

/** Exige **todas** as permissões listadas (lista vazia equivale a não declarar). */
export const Permissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
