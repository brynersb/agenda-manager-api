import { Controller, Get, HttpCode, HttpStatus, Inject } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import {
  GET_USER_INFO_QUERY,
  type GetUserInfoQueryInterface,
} from '@/modules/auth/application/queries/get-user-info/get-user-info.query.interface';
import type { AuthenticatedUser } from '@/modules/auth/application/types/authenticated-user';
import { Authenticated } from '@/modules/auth/infrastructure/http/decorators/authenticated.decorator';
import { CurrentUser } from '@/modules/auth/infrastructure/http/decorators/current-user.decorator';
import { UserInfoResponseDto } from '@/modules/auth/infrastructure/http/dtos/user-info.response.dto';
import { toUserInfoResponse } from '@/modules/auth/infrastructure/http/presenters/user-info.presenter';

@ApiTags('auth')
@ApiBearerAuth('bearer')
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(GET_USER_INFO_QUERY)
    private readonly getUserInfoQuery: GetUserInfoQueryInterface,
  ) {}

  @Get('user-info')
  @Authenticated()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Identidade e permissões do usuário autenticado',
    description:
      'Fonte única de permissões do front. Usuário autenticado sem papel `content-brief-*` recebe `200` com `roles` e `permissions` vazios.',
  })
  @ApiResponse({
    status: 200,
    description: 'Identidade e permissões resolvidas',
    type: UserInfoResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Token ausente, inválido ou expirado (`UNAUTHENTICATED`)',
  })
  getUserInfo(@CurrentUser() user: AuthenticatedUser): UserInfoResponseDto {
    return toUserInfoResponse(this.getUserInfoQuery.execute(user));
  }
}
