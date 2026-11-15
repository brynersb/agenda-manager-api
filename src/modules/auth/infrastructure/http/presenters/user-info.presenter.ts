import type { UserInfo } from '@/modules/auth/application/queries/get-user-info/get-user-info.query.interface';
import type { UserInfoResponseDto } from '@/modules/auth/infrastructure/http/dtos/user-info.response.dto';

export function toUserInfoResponse(info: UserInfo): UserInfoResponseDto {
  return {
    sub: info.sub,
    name: info.name,
    email: info.email,
    roles: info.roles,
    permissions: info.permissions,
  };
}
