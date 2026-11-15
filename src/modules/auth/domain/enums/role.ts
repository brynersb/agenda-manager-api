/**
 * Papéis do sistema. Cada usuário tem exatamente um. A decisão de acesso nunca
 * vem do token: o servidor deriva as permissões do papel (`ROLE_PERMISSIONS`).
 */
export enum Role {
  Admin = 'admin',
  Editor = 'content-brief-editor',
  Viewer = 'content-brief-viewer',
}

/** Papéis conhecidos, para validar claim do token, DTOs e configuração. */
export const KNOWN_ROLES: readonly string[] = Object.values(Role);

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && KNOWN_ROLES.includes(value);
}
