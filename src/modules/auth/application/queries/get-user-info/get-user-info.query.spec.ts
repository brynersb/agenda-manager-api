import { GetUserInfoQuery } from '@/modules/auth/application/queries/get-user-info/get-user-info.query';
import { Permission } from '@/modules/auth/domain/enums/permission';
import { Role } from '@/modules/auth/domain/enums/role';

describe('GetUserInfoQuery', () => {
  const query = new GetUserInfoQuery();

  it('resolve as permissões pelo mapa, não pelo que veio no usuário', () => {
    const info = query.execute({
      sub: 'u-1',
      name: 'Leitora',
      email: 'l@x.test',
      roles: [Role.Viewer],
      permissions: [Permission.ContentBriefDelete],
    });

    expect(info).toEqual({
      sub: 'u-1',
      name: 'Leitora',
      email: 'l@x.test',
      roles: [Role.Viewer],
      permissions: [Permission.ContentBriefRead, Permission.RegistryRead],
    });
  });

  it('usuário sem papel recebe listas vazias', () => {
    const info = query.execute({
      sub: 'u-2',
      name: 'Sem Papel',
      email: null,
      roles: [],
      permissions: [],
    });

    expect(info.roles).toEqual([]);
    expect(info.permissions).toEqual([]);
    expect(info.email).toBeNull();
  });

  it('sem nome, usa o e-mail e depois o sub', () => {
    const base = { roles: [], permissions: [] };

    expect(
      query.execute({ ...base, sub: 'u-3', name: null, email: 'a@x.test' })
        .name,
    ).toBe('a@x.test');
    expect(
      query.execute({ ...base, sub: 'u-3', name: null, email: null }).name,
    ).toBe('u-3');
  });
});
