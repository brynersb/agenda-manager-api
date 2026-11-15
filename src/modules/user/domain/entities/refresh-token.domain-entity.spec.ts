import { RefreshTokenDomainEntity } from '@/modules/user/domain/entities/refresh-token.domain-entity';

const NOW = new Date('2026-11-14T12:00:00.000Z');
const LATER = new Date('2026-11-21T12:00:00.000Z');

function issue(overrides: { familyId?: string; expiresAt?: Date } = {}) {
  return RefreshTokenDomainEntity.issue(
    {
      userId: 'user-1',
      tokenHash: 'a'.repeat(64),
      expiresAt: overrides.expiresAt ?? LATER,
      ...overrides,
    },
    NOW,
  );
}

describe('RefreshTokenDomainEntity', () => {
  describe('issue', () => {
    it('inicia uma família nova no login', () => {
      const a = issue();
      const b = issue();

      expect(a.familyId).not.toBe(b.familyId);
      expect(a.id).not.toBe(a.familyId);
      expect(a.revokedAt).toBeNull();
      expect(a.replacedById).toBeNull();
      expect(a.userAgent).toBeNull();
      expect(a.ip).toBeNull();
    });

    it('continua a família do token rotacionado', () => {
      expect(issue({ familyId: 'familia-1' }).familyId).toBe('familia-1');
    });
  });

  describe('statusAt', () => {
    it('é utilizável antes de expirar', () => {
      expect(issue().statusAt(NOW)).toBe('usable');
    });

    it('expira exatamente em expiresAt', () => {
      expect(issue().statusAt(LATER)).toBe('expired');
      expect(issue().statusAt(new Date(LATER.getTime() + 1))).toBe('expired');
    });

    it('token revogado é "revoked", mesmo vencido (reuso derruba a família)', () => {
      const revoked = RefreshTokenDomainEntity.restore({
        id: 'id-1',
        userId: 'user-1',
        familyId: 'familia-1',
        tokenHash: 'b'.repeat(64),
        expiresAt: NOW,
        revokedAt: new Date('2026-11-10T00:00:00.000Z'),
        replacedById: 'id-2',
        createdAt: new Date('2026-11-03T00:00:00.000Z'),
        userAgent: null,
        ip: null,
      });

      expect(revoked.statusAt(LATER)).toBe('revoked');
      expect(revoked.replacedById).toBe('id-2');
    });
  });
});
