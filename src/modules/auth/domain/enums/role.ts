/**
 * Papéis do realm Keycloak que a API reconhece (ADR-003). O prefixo `pauta-`
 * evita colisão num Keycloak compartilhado; não existe papel de administrador.
 */
export enum Role {
  Editor = 'content-brief-editor',
  Viewer = 'content-brief-viewer',
}

/** Papéis conhecidos, para filtrar a claim do token e validar configuração. */
export const KNOWN_ROLES: readonly string[] = Object.values(Role);

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && KNOWN_ROLES.includes(value);
}
