import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';

import {
  GET_USER_INFO_QUERY,
  type GetUserInfoQueryInterface,
} from '@/modules/auth/application/queries/get-user-info/get-user-info.query.interface';
import type { AuthenticatedUser } from '@/modules/auth/application/types/authenticated-user';
import {
  CHANGE_PASSWORD_USE_CASE,
  type ChangePasswordUseCaseInterface,
} from '@/modules/auth/application/use-cases/change-password/change-password.use-case.interface';
import type { SessionContext } from '@/modules/auth/application/use-cases/common/session-issuer';
import {
  LOGIN_USE_CASE,
  type LoginUseCaseInterface,
} from '@/modules/auth/application/use-cases/login/login.use-case.interface';
import {
  LOGOUT_USE_CASE,
  type LogoutUseCaseInterface,
} from '@/modules/auth/application/use-cases/logout/logout.use-case.interface';
import {
  REFRESH_TOKEN_USE_CASE,
  type RefreshTokenUseCaseInterface,
} from '@/modules/auth/application/use-cases/refresh-token/refresh-token.use-case.interface';
import { Authenticated } from '@/modules/auth/infrastructure/http/decorators/authenticated.decorator';
import { CurrentUser } from '@/modules/auth/infrastructure/http/decorators/current-user.decorator';
import { LoginThrottle } from '@/modules/auth/infrastructure/http/decorators/login-throttle.decorator';
import { Public } from '@/modules/auth/infrastructure/http/decorators/public.decorator';
import { AuthSessionResponseDto } from '@/modules/auth/infrastructure/http/dtos/auth-session.response.dto';
import { ChangePasswordRequestDto } from '@/modules/auth/infrastructure/http/dtos/change-password.request.dto';
import { LoginRequestDto } from '@/modules/auth/infrastructure/http/dtos/login.request.dto';
import { RefreshTokenRequestDto } from '@/modules/auth/infrastructure/http/dtos/refresh-token.request.dto';
import { UserInfoResponseDto } from '@/modules/auth/infrastructure/http/dtos/user-info.response.dto';
import {
  toAuthSessionResponse,
  toUserInfoResponse,
} from '@/modules/auth/infrastructure/http/presenters/user-info.presenter';

const JSON_ERROR = 'application/json';
const NO_STORE = 'no-store';
const USER_AGENT_MAX_LENGTH = 255;

function error(statusCode: number, code: string, message: string) {
  return { example: { statusCode, code, message } };
}

const RESPONSE_401_TOKEN = {
  status: 401,
  description: 'Token ausente, inválido ou expirado (`UNAUTHENTICATED`)',
  content: {
    [JSON_ERROR]: error(401, 'UNAUTHENTICATED', 'Não autenticado.'),
  },
};

const RESPONSE_429 = {
  status: 429,
  description: 'Limite de requisições por IP excedido (`TOO_MANY_REQUESTS`)',
  content: {
    [JSON_ERROR]: error(
      429,
      'TOO_MANY_REQUESTS',
      'Muitas requisições. Tente novamente em instantes.',
    ),
  },
};

const RESPONSE_400_BODY = {
  status: 400,
  description: 'Corpo fora do contrato (`INVALID_REQUEST`)',
  content: {
    [JSON_ERROR]: {
      example: {
        statusCode: 400,
        code: 'INVALID_REQUEST',
        message: 'Requisição inválida',
        fields: [{ field: 'email', message: 'email é obrigatório' }],
      },
    },
  },
};

/** IP e user-agent da requisição, guardados com o refresh token. */
function sessionContextOf(request: Request): SessionContext {
  const userAgent = request.headers['user-agent'];
  return {
    ip: request.ip ?? null,
    userAgent: userAgent ? userAgent.slice(0, USER_AGENT_MAX_LENGTH) : null,
  };
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(LOGIN_USE_CASE)
    private readonly login: LoginUseCaseInterface,
    @Inject(REFRESH_TOKEN_USE_CASE)
    private readonly refresh: RefreshTokenUseCaseInterface,
    @Inject(LOGOUT_USE_CASE)
    private readonly logout: LogoutUseCaseInterface,
    @Inject(CHANGE_PASSWORD_USE_CASE)
    private readonly changePassword: ChangePasswordUseCaseInterface,
    @Inject(GET_USER_INFO_QUERY)
    private readonly getUserInfoQuery: GetUserInfoQueryInterface,
  ) {}

  @Post('login')
  @Public()
  @LoginThrottle()
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', NO_STORE)
  @ApiOperation({
    summary: 'Entrar com e-mail e senha',
    description:
      'Rota pública. E-mail inexistente e senha errada dão a mesma resposta `INVALID_CREDENTIALS`. Após `LOGIN_MAX_ATTEMPTS` falhas seguidas a conta fica bloqueada por `LOGIN_LOCK_MINUTES` (`ACCOUNT_LOCKED`). Limite de requisições por IP mais baixo que o das demais rotas.',
  })
  @ApiResponse({
    status: 200,
    description: 'Sessão aberta: access token, refresh token e usuário',
    type: AuthSessionResponseDto,
  })
  @ApiResponse(RESPONSE_400_BODY)
  @ApiResponse({
    status: 401,
    description: 'E-mail ou senha inválidos (`INVALID_CREDENTIALS`)',
    content: {
      [JSON_ERROR]: error(
        401,
        'INVALID_CREDENTIALS',
        'E-mail ou senha inválidos.',
      ),
    },
  })
  @ApiResponse({
    status: 403,
    description:
      'Conta bloqueada por tentativas (`ACCOUNT_LOCKED`) ou usuário desativado (`USER_DEACTIVATED`, só depois de provar a senha)',
    content: {
      [JSON_ERROR]: {
        examples: {
          locked: {
            summary: 'Conta bloqueada',
            value: {
              statusCode: 403,
              code: 'ACCOUNT_LOCKED',
              message:
                'Conta bloqueada por excesso de tentativas. Tente novamente em 15 minutos.',
            },
          },
          deactivated: {
            summary: 'Usuário desativado',
            value: {
              statusCode: 403,
              code: 'USER_DEACTIVATED',
              message: 'Usuário desativado. Procure um administrador.',
            },
          },
        },
      },
    },
  })
  @ApiResponse(RESPONSE_429)
  async loginWithPassword(
    @Body() body: LoginRequestDto,
    @Req() request: Request,
  ): Promise<AuthSessionResponseDto> {
    return toAuthSessionResponse(
      await this.login.execute({
        email: body.email,
        password: body.password,
        ...sessionContextOf(request),
      }),
    );
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', NO_STORE)
  @ApiOperation({
    summary: 'Renovar a sessão (rotação do refresh token)',
    description:
      'Rota pública. Troca o refresh token por um novo par; o token enviado deixa de valer. Apresentar um refresh token já usado revoga **toda a família** de sessões (suspeita de roubo).',
  })
  @ApiResponse({
    status: 200,
    description: 'Novo par de tokens',
    type: AuthSessionResponseDto,
  })
  @ApiResponse(RESPONSE_400_BODY)
  @ApiResponse({
    status: 401,
    description:
      'Refresh token desconhecido, expirado, revogado ou reutilizado (`INVALID_REFRESH_TOKEN`)',
    content: {
      [JSON_ERROR]: error(
        401,
        'INVALID_REFRESH_TOKEN',
        'Sessão inválida ou expirada. Entre novamente.',
      ),
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Usuário desativado (`USER_DEACTIVATED`)',
    content: {
      [JSON_ERROR]: error(
        403,
        'USER_DEACTIVATED',
        'Usuário desativado. Procure um administrador.',
      ),
    },
  })
  @ApiResponse(RESPONSE_429)
  async refreshSession(
    @Body() body: RefreshTokenRequestDto,
    @Req() request: Request,
  ): Promise<AuthSessionResponseDto> {
    return toAuthSessionResponse(
      await this.refresh.execute({
        refreshToken: body.refreshToken,
        ...sessionContextOf(request),
      }),
    );
  }

  @Post('logout')
  @Authenticated()
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Sair (revoga a família do refresh token)',
    description:
      'Exige o access token. Idempotente: refresh token desconhecido, já revogado ou de outro usuário também responde 204 e não faz nada.',
  })
  @ApiResponse({ status: 204, description: 'Sessão encerrada' })
  @ApiResponse(RESPONSE_400_BODY)
  @ApiResponse(RESPONSE_401_TOKEN)
  async logoutSession(
    @Body() body: RefreshTokenRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.logout.execute({
      userId: user.id,
      refreshToken: body.refreshToken,
    });
  }

  @Post('change-password')
  @Authenticated()
  @LoginThrottle()
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Trocar a própria senha',
    description:
      'Exige a senha atual. Limpa `mustChangePassword` e **revoga todos os refresh tokens** do usuário, inclusive o da sessão atual: depois do 204 o cliente deve entrar de novo com a senha nova.',
  })
  @ApiResponse({ status: 204, description: 'Senha alterada' })
  @ApiResponse({
    status: 400,
    description:
      'Corpo inválido, senha atual incorreta (`INVALID_CURRENT_PASSWORD`) ou nova senha fora da política (`WEAK_PASSWORD`)',
    content: {
      [JSON_ERROR]: {
        examples: {
          current: {
            summary: 'Senha atual incorreta',
            value: {
              statusCode: 400,
              code: 'INVALID_CURRENT_PASSWORD',
              message: 'A senha atual não confere.',
            },
          },
          weak: {
            summary: 'Senha fora da política',
            value: {
              statusCode: 400,
              code: 'WEAK_PASSWORD',
              message: 'A senha deve ter entre 10 e 128 caracteres.',
            },
          },
        },
      },
    },
  })
  @ApiResponse(RESPONSE_401_TOKEN)
  @ApiResponse({
    status: 403,
    description: 'Usuário desativado (`USER_DEACTIVATED`)',
    content: {
      [JSON_ERROR]: error(
        403,
        'USER_DEACTIVATED',
        'Usuário desativado. Procure um administrador.',
      ),
    },
  })
  @ApiResponse(RESPONSE_429)
  async changeOwnPassword(
    @Body() body: ChangePasswordRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.changePassword.execute({
      userId: user.id,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
    });
  }

  @Get('user-info')
  @Authenticated()
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Identidade e permissões do usuário autenticado',
    description:
      'Fonte única de permissões do front. Lê só as claims do access token (sem ir ao banco): reflete o papel de quando o token foi emitido.',
  })
  @ApiResponse({
    status: 200,
    description: 'Identidade e permissões resolvidas',
    type: UserInfoResponseDto,
  })
  @ApiResponse(RESPONSE_401_TOKEN)
  getUserInfo(@CurrentUser() user: AuthenticatedUser): UserInfoResponseDto {
    return toUserInfoResponse(this.getUserInfoQuery.execute(user));
  }
}
