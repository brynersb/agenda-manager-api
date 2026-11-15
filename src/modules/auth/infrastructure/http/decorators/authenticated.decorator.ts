import { SetMetadata } from '@nestjs/common';

export const AUTHENTICATED_KEY = 'auth:authenticated';

/** Marca a rota como "só exige estar autenticado" (sem permissão específica). */
export const Authenticated = () => SetMetadata(AUTHENTICATED_KEY, true);
