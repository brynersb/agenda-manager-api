import { GetUserInfoQuery } from '@/modules/auth/application/queries/get-user-info/get-user-info.query';
import { Permission } from '@/modules/auth/domain/enums/permission';
import { Role } from '@/modules/auth/domain/enums/role';

describe('GetUserInfoQuery', () => {
  const query = new GetUserInfoQuery();

  it('resolve as permissões pelo mapa, não pelo que veio no usuário', () => {
    const info = query.execute({
      id: 'u-1',
      name: 'Leitora',
      email: 'l@x.test',
      role: Role.Viewer,
      permissions: [Permission.ContentBriefDelete, Permission.UserWrite],
    });

    expect(info).toEqual({
      id: 'u-1',
      name: 'Leitora',
      email: 'l@x.test',
      role: Role.Viewer,
      permissions: [Permission.ContentBriefRead, Permission.RegistryRead],
    });
  });

  it('admin recebe todas as permissões, inclusive user:*', () => {
    const info = query.execute({
      id: 'u-2',
      name: 'Admin',
      email: 'a@x.test',
      role: Role.Admin,
      permissions: [],
    });

    expect(info.permissions).toEqual(Object.values(Permission));
  });
});
