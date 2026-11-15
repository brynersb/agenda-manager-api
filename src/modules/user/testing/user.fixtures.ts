import { Role } from '@/modules/auth/domain/enums/role';
import type { RefreshTokenRepositoryInterface } from '@/modules/user/application/interfaces/repositories/refresh-token.repository.interface';
import type { UserRepositoryInterface } from '@/modules/user/application/interfaces/repositories/user.repository.interface';
import type {
  UserQueryRepositoryInterface,
  UserReadModel,
} from '@/modules/user/application/interfaces/repositories/user-query.repository.interface';
import { UserDomainEntity } from '@/modules/user/domain/entities/user.domain-entity';
import { UserStatus } from '@/modules/user/domain/enums/user-status';
import { UserEmail } from '@/modules/user/domain/value-objects/user-email';
import { UserName } from '@/modules/user/domain/value-objects/user-name';
import type { ClockInterface } from '@/shared/application/interfaces/clock.interface';
import type { LoggerServiceInterface } from '@/shared/application/interfaces/logger.service.interface';
import type { PasswordHasherInterface } from '@/shared/application/interfaces/password-hasher.interface';
import type { Actor } from '@/shared/domain/actor';
import { CalendarDate } from '@/shared/domain/calendar-date';

/** Fixtures só para specs dos casos de uso de usuário e de autenticação. */

export const NOW = new Date('2026-11-14T12:00:00.000Z');
export const ACTOR: Actor = { id: 'actor-admin', name: 'Admin Ator' };

export function fixedClock(now: Date = NOW): ClockInterface {
  return { now: () => now, today: () => CalendarDate.fromUtcInstant(now) };
}

export function fakeLogger(): LoggerServiceInterface & {
  allCalls(): string;
} {
  const logger = {
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    setLogPrefix: vi.fn(),
    allCalls: () =>
      JSON.stringify([
        logger.log.mock.calls,
        logger.info.mock.calls,
        logger.warn.mock.calls,
        logger.error.mock.calls,
        logger.debug.mock.calls,
      ]),
  };
  return logger;
}

/** Hasher determinístico: o "hash" de `x` é `hashed:x`. */
export function fakeHasher() {
  return {
    hash: vi.fn(async (plain: string) => `hashed:${plain}`),
    verify: vi.fn(
      async (plain: string, hash: string) => hash === `hashed:${plain}`,
    ),
    burnVerification: vi.fn(async () => {}),
  } satisfies PasswordHasherInterface;
}

export type UserOverrides = Partial<{
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  password: string;
  mustChangePassword: boolean;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  version: number;
}>;

/** Usuário reidratado; a senha em claro padrão é `senha-correta-123`. */
export function makeUser(overrides: UserOverrides = {}): UserDomainEntity {
  return UserDomainEntity.restore({
    id: overrides.id ?? 'user-1',
    name: UserName.restore(overrides.name ?? 'Maria Souza'),
    email: UserEmail.restore(overrides.email ?? 'maria@pauta.local'),
    role: overrides.role ?? Role.Editor,
    status: overrides.status ?? UserStatus.ACTIVE,
    passwordHash: `hashed:${overrides.password ?? 'senha-correta-123'}`,
    mustChangePassword: overrides.mustChangePassword ?? false,
    failedLoginAttempts: overrides.failedLoginAttempts ?? 0,
    lockedUntil: overrides.lockedUntil ?? null,
    lastLoginAt: overrides.lastLoginAt ?? null,
    version: overrides.version ?? 3,
    audit: {
      createdAt: new Date('2026-11-01T00:00:00.000Z'),
      createdBy: 'seed',
      createdByName: 'Seed',
      updatedAt: new Date('2026-11-02T00:00:00.000Z'),
      updatedBy: 'seed',
      updatedByName: 'Seed',
    },
  });
}

export function readModelOf(user: UserDomainEntity): UserReadModel {
  return {
    id: user.id,
    name: user.name.value,
    email: user.email.value,
    role: user.role,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
    lockedUntil: user.lockedUntil,
    lastLoginAt: user.lastLoginAt,
    version: user.version,
    createdAt: user.audit.createdAt,
    createdBy: { id: user.audit.createdBy, name: user.audit.createdByName },
    updatedAt: user.audit.updatedAt,
    updatedBy: { id: user.audit.updatedBy, name: user.audit.updatedByName },
  };
}

/** Repositório de usuários com todos os métodos como `vi.fn()` sem retorno definido. */
export function fakeUserRepository() {
  return {
    findById: vi.fn<UserRepositoryInterface['findById']>(),
    findByEmail: vi.fn<UserRepositoryInterface['findByEmail']>(),
    count: vi.fn<UserRepositoryInterface['count']>(),
    countActiveAdminsExcluding:
      vi.fn<UserRepositoryInterface['countActiveAdminsExcluding']>(),
    save: vi.fn<UserRepositoryInterface['save']>(async () => {}),
    updateLoginState: vi.fn<UserRepositoryInterface['updateLoginState']>(),
  } satisfies UserRepositoryInterface;
}

export function fakeUserQueryRepository() {
  return {
    findAll: vi.fn<UserQueryRepositoryInterface['findAll']>(),
    findOneById: vi.fn<UserQueryRepositoryInterface['findOneById']>(),
  } satisfies UserQueryRepositoryInterface;
}

export function fakeRefreshTokenRepository() {
  return {
    create: vi.fn<RefreshTokenRepositoryInterface['create']>(async () => {}),
    findByTokenHash:
      vi.fn<RefreshTokenRepositoryInterface['findByTokenHash']>(),
    rotate: vi.fn<RefreshTokenRepositoryInterface['rotate']>(),
    revokeFamily: vi.fn<RefreshTokenRepositoryInterface['revokeFamily']>(
      async () => {},
    ),
    revokeAllByUserId: vi.fn<
      RefreshTokenRepositoryInterface['revokeAllByUserId']
    >(async () => {}),
  } satisfies RefreshTokenRepositoryInterface;
}
