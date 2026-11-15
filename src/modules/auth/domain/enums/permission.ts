/**
 * Permissões granulares da API (ADR-003). A ordem de declaração é a ordem em
 * que `GET /auth/user-info` as devolve.
 */
export enum Permission {
  ContentBriefRead = 'content-brief:read',
  ContentBriefWrite = 'content-brief:write',
  ContentBriefDelete = 'content-brief:delete',
  RegistryRead = 'registry:read',
  RegistryWrite = 'registry:write',
}
