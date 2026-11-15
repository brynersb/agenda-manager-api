import { Role } from '@/modules/auth/domain/enums/role';
import { UserDomainEntity } from '@/modules/user/domain/entities/user.domain-entity';
import { UserStatus } from '@/modules/user/domain/enums/user-status';
import { UserEmail } from '@/modules/user/domain/value-objects/user-email';
import { UserName } from '@/modules/user/domain/value-objects/user-name';
import { ACTOR, makeUser, NOW } from '@/modules/user/testing/user.fixtures';

const POLICY = { maxAttempts: 3, lockMinutes: 15 };
const minutesLater = (minutes: number) =>
  new Date(NOW.getTime() + minutes * 60_000);

describe('UserDomainEntity', () => {
  describe('create', () => {
    it('cria ativo, sem tentativas, versão 1 e auditoria do ator', () => {
      const user = UserDomainEntity.create(
        {
          name: UserName.create('Ana'),
          email: UserEmail.create('Ana@Pauta.Local'),
          role: Role.Viewer,
          passwordHash: 'hash',
          mustChangePassword: true,
        },
        ACTOR,
        NOW,
      );

      expect(user.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(user).toMatchObject({
        status: UserStatus.ACTIVE,
        role: Role.Viewer,
        mustChangePassword: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: null,
        version: 1,
        passwordHash: 'hash',
      });
      expect(user.email.value).toBe('ana@pauta.local');
      expect(user.audit).toMatchObject({
        createdAt: NOW,
        createdBy: ACTOR.id,
        updatedBy: ACTOR.id,
      });
    });
  });

  describe('comportamento', () => {
    it('rename e changeRole atualizam a auditoria do ator', () => {
      const user = makeUser();

      user.rename(UserName.create('Maria Lima'), ACTOR, NOW);
      user.changeRole(Role.Viewer, ACTOR, NOW);

      expect(user.name.value).toBe('Maria Lima');
      expect(user.role).toBe(Role.Viewer);
      expect(user.audit).toMatchObject({
        createdBy: 'seed',
        updatedBy: ACTOR.id,
        updatedAt: NOW,
      });
    });

    it('deactivate é idempotente e só mexe na auditoria na primeira vez', () => {
      const user = makeUser();

      user.deactivate(ACTOR, NOW);
      const first = user.audit;
      user.deactivate({ id: 'outro', name: 'Outro' }, minutesLater(5));

      expect(user.status).toBe(UserStatus.DEACTIVATED);
      expect(user.isActive).toBe(false);
      expect(user.audit).toEqual(first);
    });

    it('reactivate é idempotente e destrava a conta', () => {
      const user = makeUser({
        status: UserStatus.DEACTIVATED,
        failedLoginAttempts: 2,
        lockedUntil: minutesLater(10),
      });

      user.reactivate(ACTOR, NOW);

      expect(user.status).toBe(UserStatus.ACTIVE);
      expect(user.failedLoginAttempts).toBe(0);
      expect(user.lockedUntil).toBeNull();
      const audit = user.audit;
      user.reactivate({ id: 'outro', name: null }, minutesLater(5));
      expect(user.audit).toEqual(audit);
    });

    it('changePassword limpa mustChangePassword e o bloqueio', () => {
      const user = makeUser({
        mustChangePassword: true,
        failedLoginAttempts: 2,
        lockedUntil: minutesLater(10),
      });

      user.changePassword('novo-hash', { id: user.id, name: 'Maria' }, NOW);

      expect(user.passwordHash).toBe('novo-hash');
      expect(user.mustChangePassword).toBe(false);
      expect(user.lockedUntil).toBeNull();
      expect(user.failedLoginAttempts).toBe(0);
      expect(user.audit.updatedBy).toBe(user.id);
    });

    it('resetPassword exige nova troca e destrava a conta', () => {
      const user = makeUser({
        mustChangePassword: false,
        lockedUntil: minutesLater(10),
      });

      user.resetPassword('hash-provisorio', ACTOR, NOW);

      expect(user.passwordHash).toBe('hash-provisorio');
      expect(user.mustChangePassword).toBe(true);
      expect(user.lockedUntil).toBeNull();
    });

    it('isActiveAdmin só é verdadeiro para admin ativo', () => {
      expect(makeUser({ role: Role.Admin }).isActiveAdmin).toBe(true);
      expect(
        makeUser({ role: Role.Admin, status: UserStatus.DEACTIVATED })
          .isActiveAdmin,
      ).toBe(false);
      expect(makeUser({ role: Role.Editor }).isActiveAdmin).toBe(false);
    });
  });

  describe('bloqueio por tentativas', () => {
    it('conta falhas sem bloquear antes do limite', () => {
      const user = makeUser();

      user.registerFailedLogin(NOW, POLICY);
      user.registerFailedLogin(NOW, POLICY);

      expect(user.failedLoginAttempts).toBe(2);
      expect(user.isLockedAt(NOW)).toBe(false);
    });

    it('trava por lockMinutes ao atingir o limite e zera o contador', () => {
      const user = makeUser({ failedLoginAttempts: 2 });

      user.registerFailedLogin(NOW, POLICY);

      expect(user.failedLoginAttempts).toBe(0);
      expect(user.lockedUntil).toEqual(minutesLater(15));
      expect(user.isLockedAt(NOW)).toBe(true);
      expect(user.isLockedAt(minutesLater(14))).toBe(true);
      expect(user.lockMinutesRemaining(NOW)).toBe(15);
      expect(user.lockMinutesRemaining(minutesLater(14.5))).toBe(1);
    });

    it('destrava exatamente no fim do bloqueio', () => {
      const user = makeUser({ lockedUntil: minutesLater(15) });

      expect(user.isLockedAt(minutesLater(15))).toBe(false);
      expect(user.isLockedAt(minutesLater(16))).toBe(false);
      expect(user.lockMinutesRemaining(minutesLater(16))).toBe(0);
    });

    it('depois do bloqueio vencido, recomeça a contagem do zero', () => {
      const user = makeUser({ lockedUntil: minutesLater(15) });

      user.registerFailedLogin(minutesLater(20), POLICY);

      expect(user.lockedUntil).toBeNull();
      expect(user.failedLoginAttempts).toBe(1);
    });

    it('login com sucesso zera contador e bloqueio e registra o instante', () => {
      const user = makeUser({
        failedLoginAttempts: 2,
        lockedUntil: minutesLater(-5),
      });

      user.registerSuccessfulLogin(NOW);

      expect(user.failedLoginAttempts).toBe(0);
      expect(user.lockedUntil).toBeNull();
      expect(user.lastLoginAt).toEqual(NOW);
    });

    it('os métodos de login não mexem na auditoria nem na versão', () => {
      const user = makeUser();
      const audit = user.audit;

      user.registerFailedLogin(NOW, POLICY);
      user.registerSuccessfulLogin(NOW);

      expect(user.audit).toBe(audit);
      expect(user.version).toBe(3);
    });
  });

  it('igualdade pela identidade', () => {
    expect(makeUser({ id: 'a' }).equals(makeUser({ id: 'a', name: 'X' }))).toBe(
      true,
    );
    expect(makeUser({ id: 'a' }).equals(makeUser({ id: 'b' }))).toBe(false);
  });
});
