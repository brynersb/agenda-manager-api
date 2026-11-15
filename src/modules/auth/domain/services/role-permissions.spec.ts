import { Permission } from '@/modules/auth/domain/enums/permission';
import { Role } from '@/modules/auth/domain/enums/role';
import {
  permissionsOfRole,
  ROLE_PERMISSIONS,
} from '@/modules/auth/domain/services/role-permissions';

describe('ROLE_PERMISSIONS (travado por spec, ADR-016)', () => {
  it('admin tem todas as permissões', () => {
    expect(permissionsOfRole(Role.Admin)).toEqual(Object.values(Permission));
  });

  it('editor mantém as cinco permissões de pauta e cadastro, sem user:*', () => {
    expect(permissionsOfRole(Role.Editor)).toEqual([
      'content-brief:read',
      'content-brief:write',
      'content-brief:delete',
      'registry:read',
      'registry:write',
    ]);
  });

  it('leitor só lê pautas e cadastros, sem user:*', () => {
    expect(permissionsOfRole(Role.Viewer)).toEqual([
      'content-brief:read',
      'registry:read',
    ]);
  });

  it('só o admin recebe user:read e user:write', () => {
    for (const role of [Role.Editor, Role.Viewer]) {
      expect(permissionsOfRole(role)).not.toContain(Permission.UserRead);
      expect(permissionsOfRole(role)).not.toContain(Permission.UserWrite);
    }
    expect(permissionsOfRole(Role.Admin)).toEqual(
      expect.arrayContaining([Permission.UserRead, Permission.UserWrite]),
    );
  });

  it('devolve na ordem do enum, mesmo com o mapa desordenado', () => {
    const map = {
      ...ROLE_PERMISSIONS,
      [Role.Viewer]: [Permission.RegistryRead, Permission.ContentBriefRead],
    };

    expect(permissionsOfRole(Role.Viewer, map)).toEqual([
      Permission.ContentBriefRead,
      Permission.RegistryRead,
    ]);
  });

  it('papel desconhecido não ganha permissão', () => {
    expect(permissionsOfRole('ghost' as Role)).toEqual([]);
  });
});
