import { newAudit, updatedAudit } from '@/shared/domain/audit';

describe('audit', () => {
  const creation = new Date('2026-11-14T12:00:00Z');
  const change = new Date('2026-11-15T12:00:00Z');

  it('auditoriaNova registra criação e alteração do mesmo ator', () => {
    expect(newAudit({ id: 'u-1', name: 'Ana' }, creation)).toEqual({
      createdAt: creation,
      createdBy: 'u-1',
      createdByName: 'Ana',
      updatedAt: creation,
      updatedBy: 'u-1',
      updatedByName: 'Ana',
    });
  });

  it('auditoriaAtualizada preserva a criação e troca só a alteração', () => {
    const initial = newAudit({ id: 'u-1', name: 'Ana' }, creation);

    expect(updatedAudit(initial, { id: 'u-2', name: null }, change)).toEqual({
      createdAt: creation,
      createdBy: 'u-1',
      createdByName: 'Ana',
      updatedAt: change,
      updatedBy: 'u-2',
      updatedByName: null,
    });
    expect(initial.updatedBy).toBe('u-1');
  });
});
