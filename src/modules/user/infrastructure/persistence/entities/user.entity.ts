import { Column, Entity, PrimaryColumn, VersionColumn } from 'typeorm';

import { Role } from '@/modules/auth/domain/enums/role';
import { UserStatus } from '@/modules/user/domain/enums/user-status';
import { AuditColumns } from '@/shared/infrastructure/persistence/audit.columns';

/**
 * Tabela `users`. O e-mail é guardado já em minúsculas e o índice único
 * `ux_users_email` é sobre `lower(email)` (índice funcional que só existe na
 * migration). `password_hash` nunca sai da camada de persistência.
 */
@Entity('users')
export class UserEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 254 })
  email: string;

  @Column({ type: 'enum', enum: Role, enumName: 'user_role' })
  role: Role;

  @Column({
    type: 'enum',
    enum: UserStatus,
    enumName: 'user_status',
    default: UserStatus.ACTIVE,
  })
  status: UserStatus;

  @Column({ type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ type: 'boolean', default: true })
  mustChangePassword: boolean;

  @Column({ type: 'int', default: 0 })
  failedLoginAttempts: number;

  @Column({ type: 'timestamptz', nullable: true })
  lockedUntil: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @VersionColumn()
  version: number;

  @Column(() => AuditColumns, { prefix: false })
  audit: AuditColumns;
}
