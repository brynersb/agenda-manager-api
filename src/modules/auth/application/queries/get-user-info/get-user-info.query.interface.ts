import type { AuthenticatedUser } from '@/modules/auth/application/types/authenticated-user';
import type { Permission } from '@/modules/auth/domain/enums/permission';
import type { Role } from '@/modules/auth/domain/enums/role';

export type UserInfo = {
  sub: string;
  name: string;
  email: string | null;
  roles: Role[];
  permissions: Permission[];
};

export interface GetUserInfoQueryInterface {
  execute(user: AuthenticatedUser): UserInfo;
}

export const GET_USER_INFO_QUERY = Symbol('GetUserInfoQueryInterface');
