import type { Permission } from '@/modules/auth/domain/enums/permission';
import type { Role } from '@/modules/auth/domain/enums/role';

/** Identidade e permissões do usuário, no formato que o login e `GET /auth/user-info` devolvem. */
export type UserInfo = {
  id: string;
  email: string;
  name: string;
  role: Role;
  /** Derivadas do papel pelo servidor; o front nunca reimplementa o mapa. */
  permissions: Permission[];
};

/** Resultado de login e de refresh: um novo par de tokens. */
export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  /** Validade do access token, em segundos. */
  expiresIn: number;
  mustChangePassword: boolean;
  user: UserInfo;
};
