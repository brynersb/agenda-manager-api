import type { UserReadModel } from '@/modules/user/application/interfaces/repositories/user-query.repository.interface';
import type { ListUsersResult } from '@/modules/user/application/queries/list-users/list-users.query.interface';
import type {
  ListUsersResponseDto,
  UserResponseDto,
  UserWithTemporaryPasswordResponseDto,
} from '@/modules/user/infrastructure/http/dtos/user.response.dto';
import { toPageResponse } from '@/shared/infrastructure/http/pagination/page.response';

export function toUserResponse(user: UserReadModel): UserResponseDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
    lockedUntil: user.lockedUntil ? user.lockedUntil.toISOString() : null,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    version: user.version,
    createdAt: user.createdAt.toISOString(),
    createdBy: { id: user.createdBy.id, name: user.createdBy.name },
    updatedAt: user.updatedAt.toISOString(),
    updatedBy: { id: user.updatedBy.id, name: user.updatedBy.name },
  };
}

export function toUserListResponse(
  result: ListUsersResult,
): ListUsersResponseDto {
  return toPageResponse(
    result.data.map(toUserResponse),
    result.total,
    result.page,
    result.limit,
  );
}

export function toUserWithTemporaryPasswordResponse(result: {
  user: UserReadModel;
  temporaryPassword: string | null;
}): UserWithTemporaryPasswordResponseDto {
  return {
    user: toUserResponse(result.user),
    temporaryPassword: result.temporaryPassword,
  };
}
