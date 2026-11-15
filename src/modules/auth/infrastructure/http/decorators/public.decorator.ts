import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'auth:isPublic';

/** Libera a rota de autenticação e de permissão (só `/health`). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
