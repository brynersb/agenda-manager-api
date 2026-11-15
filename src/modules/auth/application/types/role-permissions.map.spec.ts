import {
  permissionsOfRoles,
  ROLE_PERMISSIONS,
} from '@/modules/auth/application/types/role-permissions.map';
import { Role } from '@/modules/auth/domain/enums/role';

describe('ROLE_PERMISSIONS (tabela do ADR-003)', () => {
  it('trava a tabela inteira papel -> permissões', () => {
    expect(ROLE_PERMISSIONS).toEqual({
      'content-brief-editor': [
        'content-brief:read',
        'content-brief:write',
        'content-brief:delete',
        'registry:read',
        'registry:write',
      ],
      'content-brief-viewer': ['content-brief:read', 'registry:read'],
    });
  });

  it('não existe papel além de editor e leitor', () => {
    expect(Object.keys(ROLE_PERMISSIONS).sort()).toEqual([
      'content-brief-editor',
      'content-brief-viewer',
    ]);
  });

  it('permissionsOfRoles aplica o mapa', () => {
    expect(permissionsOfRoles([Role.Viewer])).toEqual([
      'content-brief:read',
      'registry:read',
    ]);
    expect(permissionsOfRoles([])).toEqual([]);
  });
});
