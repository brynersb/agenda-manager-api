import { Column, Entity, PrimaryColumn, VersionColumn } from 'typeorm';

import { ContentBriefAction } from '@/modules/content-brief/domain/enums/content-brief-action';
import { ContentBriefChannel } from '@/modules/content-brief/domain/enums/content-brief-channel';
import { ContentBriefStatus } from '@/modules/content-brief/domain/enums/content-brief-status';
import { AuditColumns } from '@/shared/infrastructure/persistence/audit.columns';

/**
 * Tabela `content_briefs`. Empreendimento e responsável são só colunas de id (as FKs
 * existem na migration): o entity não importa os entities dos outros módulos.
 * `due_date` é `date` e trafega como `'YYYY-MM-DD'`; o TypeORM converte `Date`
 * em dia civil com o fuso local nos dois sentidos, então não desloca o dia.
 * Os índices parciais (`WHERE deleted_at IS NULL`) existem só na migration.
 */
@Entity('content_briefs')
export class ContentBriefEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'varchar', length: 140 })
  title: string;

  @Column({ type: 'varchar', length: 1200, default: '' })
  description: string;

  @Column({ type: 'date', nullable: true })
  dueDate: string | null;

  @Column({
    type: 'enum',
    enum: ContentBriefStatus,
    enumName: 'content_brief_status',
    default: ContentBriefStatus.TODO,
  })
  status: ContentBriefStatus;

  @Column({
    type: 'enum',
    enum: ContentBriefAction,
    enumName: 'content_brief_action',
    nullable: true,
  })
  action: ContentBriefAction | null;

  @Column({
    type: 'enum',
    enum: ContentBriefChannel,
    enumName: 'content_brief_channel',
    nullable: true,
  })
  channel: ContentBriefChannel | null;

  @Column({ type: 'uuid', nullable: true })
  estateDevelopmentId: string | null;

  @Column({ type: 'uuid', nullable: true })
  ownerId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  deletedBy: string | null;

  @VersionColumn()
  version: number;

  @Column(() => AuditColumns, { prefix: false })
  audit: AuditColumns;
}
