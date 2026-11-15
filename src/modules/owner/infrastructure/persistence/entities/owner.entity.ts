import { Column, Entity, Index, PrimaryColumn, VersionColumn } from 'typeorm';

import { AuditColumns } from '@/shared/infrastructure/persistence/audit.columns';

/**
 * Tabela `owners`. O índice único é sobre `normalized_name`, que o
 * domínio calcula (a migration não recalcula) e vale também para arquivados.
 * `normalized_name` é mais largo que `nome` porque a decomposição Unicode
 * pode alongar o texto.
 */
@Entity('owners')
@Index('ux_owners_name', ['normalizedName'], { unique: true })
export class OwnerEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ type: 'varchar', length: 240 })
  normalizedName: string;

  @Column({ type: 'varchar', length: 254, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  keycloakUserId: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @VersionColumn()
  version: number;

  @Column(() => AuditColumns, { prefix: false })
  audit: AuditColumns;
}
