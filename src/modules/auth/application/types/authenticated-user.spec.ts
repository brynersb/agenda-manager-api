import { toActor } from '@/modules/auth/application/types/authenticated-user';
import { Role } from '@/modules/auth/domain/enums/role';

describe('toActor', () => {
  it('converte id e name em Actor', () => {
    expect(
      toActor({
        id: 'u-1',
        name: 'Maria',
        email: 'maria@x.test',
        role: Role.Editor,
        permissions: [],
      }),
    ).toEqual({ id: 'u-1', name: 'Maria' });
  });
});
