import type { UserInfo } from '@/modules/auth/application/types/auth-session';
import type { AuthenticatedUser } from '@/modules/auth/application/types/authenticated-user';

export interface GetUserInfoQueryInterface {
  execute(user: AuthenticatedUser): UserInfo;
}

export const GET_USER_INFO_QUERY = Symbol('GetUserInfoQueryInterface');
