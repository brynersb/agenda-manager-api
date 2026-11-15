import { Permission } from '@/modules/auth/domain/enums/permission';
import { Role } from '@/modules/auth/domain/enums/role';
import {
  type RolePermissionsMap,
  resolvePermissions,
} from '@/modules/auth/domain/services/resolve-permissions';

const map: RolePermissionsMap = {
  [Role.Editor]: [Permission.RegistryWrite, Permission.ContentBriefRead],
  [Role.Viewer]: [Permission.ContentBriefRead],
};

describe('resolvePermissions', () => {
  it('devolve lista vazia sem papéis', () => {
    expect(resolvePermissions([], map)).toEqual([]);
  });

  it('une papéis sem repetir e na ordem do enum Permissao', () => {
    expect(resolvePermissions([Role.Editor, Role.Viewer], map)).toEqual([
      Permission.ContentBriefRead,
      Permission.RegistryWrite,
    ]);
  });

  it('a ordem dos papéis não muda o resultado', () => {
    expect(resolvePermissions([Role.Viewer, Role.Editor], map)).toEqual(
      resolvePermissions([Role.Editor, Role.Viewer], map),
    );
  });
});
