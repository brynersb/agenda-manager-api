/**
 * Access tokens de teste, um por perfil. O `E2eOidcTokenService` os resolve para
 * claims fixas; nenhum Keycloak participa do e2e da API (ADR-009).
 */
export const TOKENS = {
  editor: 'token-editor',
  viewer: 'token-viewer',
  noRole: 'token-no-role',
} as const;
