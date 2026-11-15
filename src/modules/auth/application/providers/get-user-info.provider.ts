import type { Provider } from '@nestjs/common';

import { GetUserInfoQuery } from '@/modules/auth/application/queries/get-user-info/get-user-info.query';
import {
  GET_USER_INFO_QUERY,
  type GetUserInfoQueryInterface,
} from '@/modules/auth/application/queries/get-user-info/get-user-info.query.interface';

export const GetUserInfoProvider: Provider = {
  provide: GET_USER_INFO_QUERY,
  useFactory: (): GetUserInfoQueryInterface => new GetUserInfoQuery(),
};
