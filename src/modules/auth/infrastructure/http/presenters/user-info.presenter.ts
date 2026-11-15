import type {
  AuthSession,
  UserInfo,
} from '@/modules/auth/application/types/auth-session';
import type { AuthSessionResponseDto } from '@/modules/auth/infrastructure/http/dtos/auth-session.response.dto';
import type { UserInfoResponseDto } from '@/modules/auth/infrastructure/http/dtos/user-info.response.dto';

export function toUserInfoResponse(info: UserInfo): UserInfoResponseDto {
  return {
    id: info.id,
    email: info.email,
    name: info.name,
    role: info.role,
    permissions: info.permissions,
  };
}

export function toAuthSessionResponse(
  session: AuthSession,
): AuthSessionResponseDto {
  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresIn: session.expiresIn,
    mustChangePassword: session.mustChangePassword,
    user: toUserInfoResponse(session.user),
  };
}
