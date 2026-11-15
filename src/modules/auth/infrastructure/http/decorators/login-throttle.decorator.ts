import { SetMetadata } from '@nestjs/common';

export const LOGIN_THROTTLE_KEY = 'auth:loginThrottle';

/** Nome do limitador mais restrito (`LOGIN_THROTTLE_LIMIT_PER_MINUTE`) no `ThrottlerModule`. */
export const LOGIN_THROTTLER_NAME = 'login';

/**
 * Marca a rota para o limite de requisições mais baixo do login (por IP, além
 * do limite global). O `ThrottlerModule` ignora o limitador `login` nas rotas
 * sem esta marca.
 */
export const LoginThrottle = () => SetMetadata(LOGIN_THROTTLE_KEY, true);
