import {
  type AuthenticatedUser,
  toActor,
} from '@/modules/auth/application/types/authenticated-user';

describe('toActor', () => {
  it('converte sub e name em Actor', () => {
    const user: AuthenticatedUser = {
      sub: 'u-1',
      name: 'Maria',
      email: 'maria@x.test',
      roles: [],
      permissions: [],
    };

    expect(toActor(user)).toEqual({ id: 'u-1', name: 'Maria' });
  });

  it('mantém name nulo', () => {
    const actor = toActor({
      sub: 'u-2',
      name: null,
      email: null,
      roles: [],
      permissions: [],
    });

    expect(actor).toEqual({ id: 'u-2', name: null });
  });
});
