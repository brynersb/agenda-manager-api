/**
 * Permissões granulares da API (ADR-003, ADR-016). A ordem de declaração é a
 * ordem em que `GET /auth/user-info` e o login as devolvem.
 */
export enum Permission {
  ContentBriefRead = 'content-brief:read',
  ContentBriefWrite = 'content-brief:write',
  ContentBriefDelete = 'content-brief:delete',
  RegistryRead = 'registry:read',
  RegistryWrite = 'registry:write',
  UserRead = 'user:read',
  UserWrite = 'user:write',
}
