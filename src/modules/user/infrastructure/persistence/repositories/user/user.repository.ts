import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

import { Role } from '@/modules/auth/domain/enums/role';
import type { UserRepositoryInterface } from '@/modules/user/application/interfaces/repositories/user.repository.interface';
import type { UserDomainEntity } from '@/modules/user/domain/entities/user.domain-entity';
import { UserStatus } from '@/modules/user/domain/enums/user-status';
import {
  EmailAlreadyRegisteredError,
  LastAdminError,
  UserNotFoundError,
  UserVersionOutdatedError,
} from '@/modules/user/domain/errors/user.errors';
import { UserEntity } from '@/modules/user/infrastructure/persistence/entities/user.entity';
import { UserMapper } from '@/modules/user/infrastructure/persistence/mappers/user.mapper';
import { isUniqueViolation } from '@/shared/infrastructure/persistence/database-error.util';

const EMAIL_INDEX = 'ux_users_email';

/**
 * Chave do advisory lock que serializa as gravações capazes de tirar um
 * administrador (desativar, rebaixar). Valor fixo e arbitrário, só desta tabela.
 */
const ADMIN_GUARD_LOCK = 7_411_001;

@Injectable()
export class UserRepository implements UserRepositoryInterface {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repository: Repository<UserEntity>,
  ) {}

  async findById(id: string): Promise<UserDomainEntity | null> {
    const entity = await this.repository.findOneBy({ id });
    return entity ? UserMapper.toDomain(entity) : null;
  }

  async findByEmail(normalizedEmail: string): Promise<UserDomainEntity | null> {
    const entity = await this.repository
      .createQueryBuilder('u')
      .where('lower(u.email) = :email', { email: normalizedEmail })
      .getOne();
    return entity ? UserMapper.toDomain(entity) : null;
  }

  count(): Promise<number> {
    return this.repository.count();
  }

  countActiveAdminsExcluding(userId: string): Promise<number> {
    return this.repository
      .createQueryBuilder('u')
      .where('u.role = :role AND u.status = :status AND u.id <> :userId', {
        role: Role.Admin,
        status: UserStatus.ACTIVE,
        userId,
      })
      .getCount();
  }

  async save(user: UserDomainEntity, expectedVersion?: number): Promise<void> {
    const entity = UserMapper.toEntity(user);
    try {
      if (expectedVersion === undefined) {
        await this.repository.insert(entity);
        return;
      }
      await this.updateWithVersionCheck(user, entity, expectedVersion);
    } catch (error) {
      if (isUniqueViolation(error, EMAIL_INDEX)) {
        throw new EmailAlreadyRegisteredError();
      }
      throw error;
    }
  }

  async updateLoginState(
    id: string,
    mutate: (user: UserDomainEntity) => void,
  ): Promise<UserDomainEntity | null> {
    return this.repository.manager.transaction(async (tx) => {
      const entity = await tx.findOne(UserEntity, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!entity) {
        return null;
      }
      const user = UserMapper.toDomain(entity);
      mutate(user);
      // SQL direto de propósito: o QueryBuilder somaria 1 em `version`, e um
      // login não pode invalidar a versão que um administrador está editando.
      await tx.query(
        `UPDATE users
            SET failed_login_attempts = $2, locked_until = $3, last_login_at = $4
          WHERE id = $1`,
        [id, user.failedLoginAttempts, user.lockedUntil, user.lastLoginAt],
      );
      return user;
    });
  }

  /**
   * `UPDATE ... WHERE version = esperada` (o TypeORM soma 1 em `version`), numa
   * transação. Quando a gravação não é de um administrador ativo, o advisory
   * lock serializa as gravações concorrentes e, se a linha era administrador
   * ativo e deixou de ser, a contagem depois do UPDATE garante que sobrou
   * algum: é a rede de segurança da regra do último admin contra corrida.
   */
  private async updateWithVersionCheck(
    user: UserDomainEntity,
    entity: UserEntity,
    expectedVersion: number,
  ): Promise<void> {
    await this.repository.manager.transaction(async (tx) => {
      if (!user.isActiveAdmin) {
        await tx.query(`SELECT pg_advisory_xact_lock(${ADMIN_GUARD_LOCK})`);
      }
      const before: { role: Role; status: UserStatus }[] = await tx.query(
        'SELECT role, status FROM users WHERE id = $1 FOR UPDATE',
        [entity.id],
      );
      if (before.length === 0) {
        throw new UserNotFoundError();
      }

      const changes: QueryDeepPartialEntity<UserEntity> = {
        name: entity.name,
        role: entity.role,
        status: entity.status,
        passwordHash: entity.passwordHash,
        mustChangePassword: entity.mustChangePassword,
        audit: {
          updatedAt: entity.audit.updatedAt,
          updatedBy: entity.audit.updatedBy,
          updatedByName: entity.audit.updatedByName,
        },
      };
      // O domínio só zera o bloqueio (troca/redefinição de senha, reativação);
      // um estado de bloqueio ativo é do `updateLoginState` e não é regravado.
      if (entity.failedLoginAttempts === 0 && entity.lockedUntil === null) {
        changes.failedLoginAttempts = 0;
        changes.lockedUntil = null;
      }

      const result = await tx
        .createQueryBuilder()
        .update(UserEntity)
        .set(changes)
        .where('id = :id AND version = :expectedVersion', {
          id: entity.id,
          expectedVersion,
        })
        .execute();
      if (!result.affected) {
        throw new UserVersionOutdatedError();
      }

      const wasActiveAdmin =
        before[0].role === Role.Admin && before[0].status === UserStatus.ACTIVE;
      if (wasActiveAdmin && !user.isActiveAdmin) {
        const remaining = await tx
          .createQueryBuilder(UserEntity, 'u')
          .where('u.role = :role AND u.status = :status', {
            role: Role.Admin,
            status: UserStatus.ACTIVE,
          })
          .getCount();
        if (remaining === 0) {
          throw new LastAdminError();
        }
      }
    });
  }
}
