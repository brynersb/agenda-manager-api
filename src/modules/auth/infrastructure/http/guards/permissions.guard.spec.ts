import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { AuthenticatedUser } from '@/modules/auth/application/types/authenticated-user';
import { Permission } from '@/modules/auth/domain/enums/permission';
import { Role } from '@/modules/auth/domain/enums/role';
import {
  ForbiddenAccessError,
  UnauthenticatedError,
} from '@/modules/auth/domain/errors/auth.errors';
import { Authenticated } from '@/modules/auth/infrastructure/http/decorators/authenticated.decorator';
import { Permissions } from '@/modules/auth/infrastructure/http/decorators/permissions.decorator';
import { Public } from '@/modules/auth/infrastructure/http/decorators/public.decorator';
import { PermissionsGuard } from '@/modules/auth/infrastructure/http/guards/permissions.guard';
import type { AuthenticatedRequest } from '@/modules/auth/infrastructure/http/types/authenticated-request';
import { ForbiddenError } from '@/shared/domain/errors/domain-error';

class NoDecorator {
  handler() {}
}

class WithPermissions {
  @Permissions(Permission.ContentBriefRead, Permission.ContentBriefWrite)
  write() {}

  @Permissions(Permission.ContentBriefRead)
  read() {}

  @Permissions()
  empty() {}

  @Authenticated()
  onlyAuthenticated() {}

  @Public()
  publicRoute() {}

  @Permissions(Permission.UserRead)
  listUsers() {}

  @Permissions(Permission.UserWrite)
  writeUsers() {}
}

@Permissions(Permission.RegistryRead)
class ControllerWithClassPermission {
  handler() {}
}

@Public()
class ControllerPublicOnClass {
  handler() {}
}

function context(
  target: new () => object,
  method: string,
  user?: AuthenticatedUser,
): ExecutionContext {
  const request = { user } as unknown as AuthenticatedRequest;
  return {
    getHandler: () => (target.prototype as Record<string, () => void>)[method],
    getClass: () => target,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function user(role: Role, permissions: Permission[]): AuthenticatedUser {
  return {
    id: 'u-1',
    name: 'Maria',
    email: 'm@x.test',
    role,
    permissions,
    mustChangePassword: false,
  };
}

const editor = user(Role.Editor, [
  Permission.ContentBriefRead,
  Permission.ContentBriefWrite,
  Permission.ContentBriefDelete,
  Permission.RegistryRead,
  Permission.RegistryWrite,
]);
const viewer = user(Role.Viewer, [
  Permission.ContentBriefRead,
  Permission.RegistryRead,
]);
const admin = user(Role.Admin, Object.values(Permission));

describe('PermissionsGuard', () => {
  const logger = {
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    setLogPrefix: vi.fn(),
  };
  const guard = new PermissionsGuard(new Reflector(), logger);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('libera @Public no método e na classe, mesmo sem usuário', () => {
    expect(guard.canActivate(context(WithPermissions, 'publicRoute'))).toBe(
      true,
    );
    expect(guard.canActivate(context(ControllerPublicOnClass, 'handler'))).toBe(
      true,
    );
  });

  it('nega por padrão handler sem @Permissions, @Authenticated ou @Public (403) e registra', () => {
    const action = () =>
      guard.canActivate(context(NoDecorator, 'handler', editor));

    expect(action).toThrow(ForbiddenAccessError);
    expect(action).toThrow(ForbiddenError);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        'evt.name': 'auth.permissions.missing_decorator',
        outcome: 'blocked',
        controller: 'NoDecorator',
        handler: 'handler',
      }),
    );
  });

  it('@Permissions() vazio conta como ausente e nega', () => {
    expect(() =>
      guard.canActivate(context(WithPermissions, 'empty', editor)),
    ).toThrow(ForbiddenAccessError);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        'evt.name': 'auth.permissions.missing_decorator',
      }),
    );
  });

  it('@Authenticated deixa passar qualquer usuário autenticado, mesmo sem permissão nenhuma', () => {
    const noPermission = user(Role.Viewer, []);

    expect(
      guard.canActivate(
        context(WithPermissions, 'onlyAuthenticated', noPermission),
      ),
    ).toBe(true);
  });

  it('só o admin passa em rotas user:read e user:write', () => {
    for (const method of ['listUsers', 'writeUsers']) {
      expect(guard.canActivate(context(WithPermissions, method, admin))).toBe(
        true,
      );
      for (const other of [editor, viewer]) {
        expect(() =>
          guard.canActivate(context(WithPermissions, method, other)),
        ).toThrow(ForbiddenAccessError);
      }
    }
  });

  it('@Authenticated sem usuário resulta em 401', () => {
    expect(() =>
      guard.canActivate(context(WithPermissions, 'onlyAuthenticated')),
    ).toThrow(UnauthenticatedError);
  });

  it('exige todas as permissões do @Permissions', () => {
    expect(guard.canActivate(context(WithPermissions, 'write', editor))).toBe(
      true,
    );
    expect(() =>
      guard.canActivate(context(WithPermissions, 'write', viewer)),
    ).toThrow(ForbiddenAccessError);
  });

  it('403 FORBIDDEN tem code e mensagem do contrato e não vaza o usuário', () => {
    const error = (() => {
      try {
        guard.canActivate(context(WithPermissions, 'write', viewer));
      } catch (e) {
        return e;
      }
    })();

    expect(error).toMatchObject({
      code: 'FORBIDDEN',
      kind: 'FORBIDDEN',
      message: 'Você não tem permissão para esta ação.',
    });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        'evt.name': 'auth.permissions.denied',
        outcome: 'blocked',
        user_sub: 'u-1',
      }),
    );
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('m@x.test');
  });

  it('leitor passa em rota de leitura', () => {
    expect(guard.canActivate(context(WithPermissions, 'read', viewer))).toBe(
      true,
    );
  });

  it('lê @Permissions declarado na classe (getAllAndOverride)', () => {
    expect(
      guard.canActivate(
        context(ControllerWithClassPermission, 'handler', viewer),
      ),
    ).toBe(true);
    expect(() =>
      guard.canActivate(
        context(
          ControllerWithClassPermission,
          'handler',
          user(Role.Viewer, []),
        ),
      ),
    ).toThrow(ForbiddenAccessError);
  });

  it('rota protegida sem usuário resulta em 401', () => {
    expect(() => guard.canActivate(context(WithPermissions, 'read'))).toThrow(
      UnauthenticatedError,
    );
  });
});
