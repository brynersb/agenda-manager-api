import {
  type ContentBriefData,
  ContentBriefDomainEntity,
} from '@/modules/content-brief/domain/entities/content-brief.domain-entity';
import { ContentBriefAction } from '@/modules/content-brief/domain/enums/content-brief-action';
import { ContentBriefChannel } from '@/modules/content-brief/domain/enums/content-brief-channel';
import { ContentBriefStatus } from '@/modules/content-brief/domain/enums/content-brief-status';
import {
  ContentBriefNotFoundError,
  ContentBriefVersionOutdatedError,
} from '@/modules/content-brief/domain/errors/content-brief.errors';
import { Description } from '@/modules/content-brief/domain/value-objects/description';
import { Title } from '@/modules/content-brief/domain/value-objects/title';
import { newAudit } from '@/shared/domain/audit';
import { CalendarDate } from '@/shared/domain/calendar-date';

const author = { id: 'u-1', name: 'Ana' };
const other = { id: 'u-2', name: 'Bia' };
const t0 = new Date('2026-11-14T12:00:00Z');
const t1 = new Date('2026-11-15T12:00:00Z');
const t2 = new Date('2026-11-16T12:00:00Z');
const UUID_V7 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function data(overrides: Partial<ContentBriefData> = {}): ContentBriefData {
  return {
    title: Title.create('Post de lançamento'),
    description: Description.empty(),
    dueDate: null,
    action: null,
    channel: null,
    estateDevelopmentId: null,
    ownerId: null,
    ...overrides,
  };
}

function created(overrides: Partial<ContentBriefData> = {}) {
  return ContentBriefDomainEntity.create(data(overrides), author, t0);
}

describe('ContentBriefDomainEntity', () => {
  describe('create', () => {
    it('nasce em TODO, versão 1, com id uuid v7 e auditoria do ator', () => {
      const brief = created();

      expect(brief.id).toMatch(UUID_V7);
      expect(brief.title.value).toBe('Post de lançamento');
      expect(brief.status).toBe(ContentBriefStatus.TODO);
      expect(brief.version).toBe(1);
      expect(brief.completedAt).toBeNull();
      expect(brief.deletion).toBeNull();
      expect(brief.audit).toEqual(newAudit(author, t0));
    });

    it('guarda todos os campos informados', () => {
      const brief = created({
        description: Description.create('Arte aprovada'),
        dueDate: CalendarDate.of('2026-11-20'),
        action: ContentBriefAction.CREATE,
        channel: ContentBriefChannel.INSTAGRAM,
        estateDevelopmentId: 'e-1',
        ownerId: 'o-1',
      });

      expect(brief.description.value).toBe('Arte aprovada');
      expect(brief.dueDate?.toString()).toBe('2026-11-20');
      expect(brief.action).toBe(ContentBriefAction.CREATE);
      expect(brief.channel).toBe(ContentBriefChannel.INSTAGRAM);
      expect(brief.estateDevelopmentId).toBe('e-1');
      expect(brief.ownerId).toBe('o-1');
    });

    it('criar já em DONE grava completedAt', () => {
      const brief = created({ status: ContentBriefStatus.DONE });

      expect(brief.status).toBe(ContentBriefStatus.DONE);
      expect(brief.completedAt).toBe(t0);
    });

    it('gera ids diferentes', () => {
      expect(created().id).not.toBe(created().id);
    });
  });

  describe('restore', () => {
    it('reidrata o snapshot sem alterar nada', () => {
      const audit = newAudit(author, t0);
      const brief = ContentBriefDomainEntity.restore({
        id: 'id-1',
        title: Title.restore('Título'),
        description: Description.restore('Texto'),
        dueDate: CalendarDate.of('2026-11-14'),
        status: ContentBriefStatus.DONE,
        action: ContentBriefAction.ANALYZE,
        channel: ContentBriefChannel.REPORT,
        estateDevelopmentId: 'e-1',
        ownerId: 'o-1',
        completedAt: t1,
        deletion: { at: t2, by: 'u-2' },
        version: 7,
        audit,
      });

      expect(brief.id).toBe('id-1');
      expect(brief.status).toBe(ContentBriefStatus.DONE);
      expect(brief.completedAt).toBe(t1);
      expect(brief.deletion).toEqual({ at: t2, by: 'u-2' });
      expect(brief.version).toBe(7);
      expect(brief.audit).toBe(audit);
    });
  });

  describe('update', () => {
    it('substitui os campos e atualiza só a auditoria de alteração', () => {
      const brief = created({
        description: Description.create('antiga'),
        action: ContentBriefAction.CREATE,
        estateDevelopmentId: 'e-1',
      });

      brief.update(
        data({
          title: Title.create('Novo título'),
          dueDate: CalendarDate.of('2026-12-01'),
          channel: ContentBriefChannel.BLOG,
          ownerId: 'o-2',
        }),
        1,
        other,
        t1,
      );

      expect(brief.title.value).toBe('Novo título');
      expect(brief.description.value).toBe('');
      expect(brief.dueDate?.toString()).toBe('2026-12-01');
      expect(brief.action).toBeNull();
      expect(brief.channel).toBe(ContentBriefChannel.BLOG);
      expect(brief.estateDevelopmentId).toBeNull();
      expect(brief.ownerId).toBe('o-2');
      expect(brief.audit).toMatchObject({
        createdBy: 'u-1',
        createdAt: t0,
        updatedBy: 'u-2',
        updatedByName: 'Bia',
        updatedAt: t1,
      });
      expect(brief.version).toBe(1);
    });

    it('status ausente mantém o atual', () => {
      const brief = created({ status: ContentBriefStatus.IN_REVIEW });

      brief.update(data(), 1, author, t1);

      expect(brief.status).toBe(ContentBriefStatus.IN_REVIEW);
    });

    it('status informado troca o status', () => {
      const brief = created();

      brief.update(data({ status: ContentBriefStatus.DONE }), 1, author, t1);

      expect(brief.status).toBe(ContentBriefStatus.DONE);
      expect(brief.completedAt).toBe(t1);
    });

    it('versão divergente lança CONTENT_BRIEF_VERSION_OUTDATED e não altera nada', () => {
      const brief = created();

      expect(() =>
        brief.update(data({ title: Title.create('Outro') }), 2, other, t1),
      ).toThrow(ContentBriefVersionOutdatedError);
      expect(brief.title.value).toBe('Post de lançamento');
      expect(brief.audit).toEqual(newAudit(author, t0));
    });
  });

  describe('changeStatus', () => {
    it('troca livre entre os quatro status', () => {
      const brief = created();

      for (const status of [
        ContentBriefStatus.IN_REVIEW,
        ContentBriefStatus.TODO,
        ContentBriefStatus.IN_PROGRESS,
        ContentBriefStatus.DONE,
        ContentBriefStatus.TODO,
      ]) {
        brief.changeStatus(status, 1, author, t1);
        expect(brief.status).toBe(status);
      }
    });

    it('entrar em DONE grava completedAt e sair limpa', () => {
      const brief = created();

      brief.changeStatus(ContentBriefStatus.DONE, 1, author, t1);
      expect(brief.completedAt).toBe(t1);

      brief.changeStatus(ContentBriefStatus.IN_PROGRESS, 1, author, t2);
      expect(brief.completedAt).toBeNull();
    });

    it('repetir DONE mantém o instante original', () => {
      const brief = created();
      brief.changeStatus(ContentBriefStatus.DONE, 1, author, t1);

      brief.changeStatus(ContentBriefStatus.DONE, 1, author, t2);

      expect(brief.completedAt).toBe(t1);
    });

    it('mexe só na auditoria de alteração', () => {
      const brief = created();

      brief.changeStatus(ContentBriefStatus.IN_PROGRESS, 1, other, t1);

      expect(brief.audit).toMatchObject({
        createdBy: 'u-1',
        updatedBy: 'u-2',
        updatedAt: t1,
      });
    });

    it('versão divergente lança e não altera o status', () => {
      const brief = created();

      expect(() =>
        brief.changeStatus(ContentBriefStatus.DONE, 3, author, t1),
      ).toThrow(ContentBriefVersionOutdatedError);
      expect(brief.status).toBe(ContentBriefStatus.TODO);
      expect(brief.completedAt).toBeNull();
    });
  });

  describe('delete', () => {
    it('grava quem e quando e atualiza a auditoria', () => {
      const brief = created();

      brief.delete(other, t1);

      expect(brief.deletion).toEqual({ at: t1, by: 'u-2' });
      expect(brief.audit).toMatchObject({ updatedBy: 'u-2', updatedAt: t1 });
    });

    it('excluída se comporta como inexistente: delete, update e changeStatus lançam 404', () => {
      const brief = created();
      brief.delete(author, t1);

      expect(() => brief.delete(author, t2)).toThrow(ContentBriefNotFoundError);
      expect(() => brief.update(data(), 1, author, t2)).toThrow(
        ContentBriefNotFoundError,
      );
      expect(() =>
        brief.changeStatus(ContentBriefStatus.DONE, 1, author, t2),
      ).toThrow(ContentBriefNotFoundError);
    });
  });

  describe('estateDevelopmentChanged e ownerChanged', () => {
    it('só indicam mudança quando o id é diferente do atual', () => {
      const brief = created({ estateDevelopmentId: 'e-1', ownerId: null });

      expect(brief.estateDevelopmentChanged('e-1')).toBe(false);
      expect(brief.estateDevelopmentChanged('e-2')).toBe(true);
      expect(brief.estateDevelopmentChanged(null)).toBe(true);
      expect(brief.ownerChanged(null)).toBe(false);
      expect(brief.ownerChanged('o-1')).toBe(true);
    });
  });
});
