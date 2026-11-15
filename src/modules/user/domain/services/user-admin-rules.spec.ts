import { Role } from '@/modules/auth/domain/enums/role';
import { UserStatus } from '@/modules/user/domain/enums/user-status';
import {
  CannotModifySelfError,
  LastAdminError,
} from '@/modules/user/domain/errors/user.errors';
import {
  assertNotLastActiveAdmin,
  assertNotSelf,
} from '@/modules/user/domain/services/user-admin-rules';
import { makeUser } from '@/modules/user/testing/user.fixtures';

describe('assertNotSelf', () => {
  it('recusa quando quem age é o alvo (CANNOT_MODIFY_SELF)', () => {
    expect(() => assertNotSelf('u-1', makeUser({ id: 'u-1' }))).toThrow(
      CannotModifySelfError,
    );
    expect(() => assertNotSelf('u-1', makeUser({ id: 'u-1' }))).toThrow(
      expect.objectContaining({ code: 'CANNOT_MODIFY_SELF' }),
    );
  });

  it('aceita quando são pessoas diferentes', () => {
    expect(() => assertNotSelf('u-2', makeUser({ id: 'u-1' }))).not.toThrow();
  });
});

describe('assertNotLastActiveAdmin', () => {
  const admin = makeUser({ role: Role.Admin });

  it('recusa quando o alvo é admin ativo e não há outro (LAST_ADMIN)', () => {
    expect(() => assertNotLastActiveAdmin(admin, 0)).toThrow(LastAdminError);
    expect(() => assertNotLastActiveAdmin(admin, 0)).toThrow(
      expect.objectContaining({ code: 'LAST_ADMIN', kind: 'CONFLICT' }),
    );
  });

  it('aceita quando sobra outro admin ativo', () => {
    expect(() => assertNotLastActiveAdmin(admin, 1)).not.toThrow();
  });

  it('não afeta quem não é admin ativo', () => {
    expect(() =>
      assertNotLastActiveAdmin(makeUser({ role: Role.Editor }), 0),
    ).not.toThrow();
    expect(() =>
      assertNotLastActiveAdmin(
        makeUser({ role: Role.Admin, status: UserStatus.DEACTIVATED }),
        0,
      ),
    ).not.toThrow();
  });
});
