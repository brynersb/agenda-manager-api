import { OwnerDomainEntity } from '@/modules/owner/domain/entities/owner.domain-entity';
import { Email } from '@/modules/owner/domain/value-objects/email';
import { newAudit } from '@/shared/domain/audit';
import { RegistryName } from '@/shared/domain/registry-name';

const author = { id: 'u-1', name: 'Ana' };
const other = { id: 'u-2', name: 'Bia' };
const t0 = new Date('2026-11-14T12:00:00Z');
const t1 = new Date('2026-11-15T12:00:00Z');
const t2 = new Date('2026-11-16T12:00:00Z');

function next() {
  return OwnerDomainEntity.create(
    { name: RegistryName.create('Bela Vista') },
    author,
    t0,
  );
}

describe('OwnerDomainEntity', () => {
  describe('create', () => {
    it('nasce ativo, na versão 1, com id uuid v7 e auditoria do ator', () => {
      const e = next();

      expect(e.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(e.name.value).toBe('Bela Vista');
      expect(e.email).toBeNull();
      expect(e.keycloakUserId).toBeNull();
      expect(e.active).toBe(true);
      expect(e.version).toBe(1);
      expect(e.audit).toEqual(newAudit(author, t0));
    });

    it('gera ids diferentes', () => {
      expect(next().id).not.toBe(next().id);
    });
  });

  describe('restore', () => {
    it('reidrata o snapshot sem alterar nada', () => {
      const audit = newAudit(author, t0);
      const e = OwnerDomainEntity.restore({
        id: 'id-1',
        name: RegistryName.restore('Água Clara'),
        email: Email.restore('agua@bora.com'),
        keycloakUserId: 'kc-1',
        active: false,
        version: 7,
        audit,
      });

      expect(e.id).toBe('id-1');
      expect(e.name.value).toBe('Água Clara');
      expect(e.email?.value).toBe('agua@bora.com');
      expect(e.keycloakUserId).toBe('kc-1');
      expect(e.active).toBe(false);
      expect(e.version).toBe(7);
      expect(e.audit).toBe(audit);
    });
  });

  describe('rename', () => {
    it('troca o nome e atualiza só a auditoria de alteração', () => {
      const e = next();

      e.rename(RegistryName.create('Vila Nova'), other, t1);

      expect(e.name.value).toBe('Vila Nova');
      expect(e.audit).toMatchObject({
        createdBy: 'u-1',
        createdAt: t0,
        updatedBy: 'u-2',
        updatedByName: 'Bia',
        updatedAt: t1,
      });
      expect(e.version).toBe(1);
    });
  });

  describe('e-mail', () => {
    it('criar aceita e-mail', () => {
      const e = OwnerDomainEntity.create(
        {
          name: RegistryName.create('Ana'),
          email: Email.create('ana@bora.com'),
        },
        author,
        t0,
      );

      expect(e.email?.value).toBe('ana@bora.com');
    });

    it('alterarEmail troca e remove o e-mail e atualiza a auditoria', () => {
      const e = next();

      e.changeEmail(Email.create('bela@bora.com'), other, t1);
      expect(e.email?.value).toBe('bela@bora.com');
      expect(e.audit).toMatchObject({
        updatedBy: 'u-2',
        updatedAt: t1,
      });

      e.changeEmail(null, author, t2);
      expect(e.email).toBeNull();
      expect(e.audit).toMatchObject({
        updatedBy: 'u-1',
        updatedAt: t2,
      });
    });
  });

  describe('arquivar e reativar', () => {
    it('arquivar desativa e registra quem e quando', () => {
      const e = next();

      e.archive(other, t1);

      expect(e.active).toBe(false);
      expect(e.audit).toMatchObject({
        updatedBy: 'u-2',
        updatedAt: t1,
      });
    });

    it('arquivar é idempotente: o segundo não mexe na auditoria', () => {
      const e = next();
      e.archive(other, t1);

      e.archive(author, t2);

      expect(e.active).toBe(false);
      expect(e.audit).toMatchObject({
        updatedBy: 'u-2',
        updatedAt: t1,
      });
    });

    it('reativar reativa e registra quem e quando', () => {
      const e = next();
      e.archive(author, t1);

      e.reactivate(other, t2);

      expect(e.active).toBe(true);
      expect(e.audit).toMatchObject({
        updatedBy: 'u-2',
        updatedAt: t2,
      });
    });

    it('reativar um ativo não muda nada', () => {
      const e = next();

      e.reactivate(other, t1);

      expect(e.active).toBe(true);
      expect(e.audit).toEqual(newAudit(author, t0));
    });
  });
});
