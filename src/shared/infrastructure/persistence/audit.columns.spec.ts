import { Column, DataSource, Entity, PrimaryColumn } from 'typeorm';

import {
  AuditColumns,
  applyAudit,
  type EntityWithAudit,
} from '@/shared/infrastructure/persistence/audit.columns';
import { SnakeNamingStrategy } from '@/shared/infrastructure/persistence/snake-naming.strategy';

describe('applyAudit', () => {
  const creator = { id: 'sub-1', name: 'Ana' };
  const editor = { id: 'sub-2', name: null };
  const t1 = new Date('2026-11-14T10:00:00Z');
  const t2 = new Date('2026-11-15T10:00:00Z');

  it('na criação preenche created* e updated*', () => {
    const entity: EntityWithAudit = {};

    applyAudit(entity, creator, t1);

    expect(entity.audit).toMatchObject({
      createdAt: t1,
      createdBy: 'sub-1',
      createdByName: 'Ana',
      updatedAt: t1,
      updatedBy: 'sub-1',
      updatedByName: 'Ana',
    });
  });

  it('na edição preserva created* e atualiza só updated*', () => {
    const entity: EntityWithAudit = {};
    applyAudit(entity, creator, t1);

    applyAudit(entity, editor, t2);

    const audit = entity.audit as AuditColumns;
    expect(audit).toMatchObject({
      createdAt: t1,
      createdBy: 'sub-1',
      createdByName: 'Ana',
      updatedAt: t2,
      updatedBy: 'sub-2',
      updatedByName: null,
    });
  });
});

describe('AuditColumns com SnakeNamingStrategy', () => {
  @Entity('examples')
  class ExampleEntity {
    @PrimaryColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    estateDevelopmentId: string;

    @Column(() => AuditColumns, { prefix: false })
    audit: AuditColumns;
  }

  it('gera as colunas de auditoria em snake_case, sem prefixo', async () => {
    // `buildMetadatas` é protegido; a subclasse monta o metadata sem conectar.
    class DisconnectedDataSource extends DataSource {
      buildMetadata(): Promise<void> {
        return this.buildMetadatas();
      }
    }
    const dataSource = new DisconnectedDataSource({
      type: 'postgres',
      entities: [ExampleEntity],
      namingStrategy: new SnakeNamingStrategy(),
    });
    await dataSource.buildMetadata();

    const columns = dataSource
      .getMetadata(ExampleEntity)
      .columns.map((column) => column.databaseName);

    expect(columns).toEqual([
      'id',
      'estate_development_id',
      'created_at',
      'created_by',
      'created_by_name',
      'updated_at',
      'updated_by',
      'updated_by_name',
    ]);
  });
});
