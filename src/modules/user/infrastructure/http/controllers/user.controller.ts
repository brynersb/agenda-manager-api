import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import {
  type AuthenticatedUser,
  toActor,
} from '@/modules/auth/application/types/authenticated-user';
import { Permission } from '@/modules/auth/domain/enums/permission';
import { CurrentUser } from '@/modules/auth/infrastructure/http/decorators/current-user.decorator';
import { Permissions } from '@/modules/auth/infrastructure/http/decorators/permissions.decorator';
import {
  FIND_USER_BY_ID_QUERY,
  type FindUserByIdQueryInterface,
} from '@/modules/user/application/queries/find-user-by-id/find-user-by-id.query.interface';
import {
  LIST_USERS_QUERY,
  type ListUsersQueryInterface,
} from '@/modules/user/application/queries/list-users/list-users.query.interface';
import {
  CREATE_USER_USE_CASE,
  type CreateUserUseCaseInterface,
} from '@/modules/user/application/use-cases/create-user/create-user.use-case.interface';
import {
  DEACTIVATE_USER_USE_CASE,
  type DeactivateUserUseCaseInterface,
} from '@/modules/user/application/use-cases/deactivate-user/deactivate-user.use-case.interface';
import {
  REACTIVATE_USER_USE_CASE,
  type ReactivateUserUseCaseInterface,
} from '@/modules/user/application/use-cases/reactivate-user/reactivate-user.use-case.interface';
import {
  RESET_USER_PASSWORD_USE_CASE,
  type ResetUserPasswordUseCaseInterface,
} from '@/modules/user/application/use-cases/reset-user-password/reset-user-password.use-case.interface';
import {
  UPDATE_USER_USE_CASE,
  type UpdateUserUseCaseInterface,
} from '@/modules/user/application/use-cases/update-user/update-user.use-case.interface';
import { CreateUserRequestDto } from '@/modules/user/infrastructure/http/dtos/create-user.request.dto';
import { ListUsersQueryDto } from '@/modules/user/infrastructure/http/dtos/list-users.query.dto';
import { UpdateUserRequestDto } from '@/modules/user/infrastructure/http/dtos/update-user.request.dto';
import {
  ListUsersResponseDto,
  UserResponseDto,
  UserWithTemporaryPasswordResponseDto,
} from '@/modules/user/infrastructure/http/dtos/user.response.dto';
import {
  toUserListResponse,
  toUserResponse,
  toUserWithTemporaryPasswordResponse,
} from '@/modules/user/infrastructure/http/presenters/user.presenter';

const JSON_ERROR = 'application/json';

const RESPONSE_401 = {
  status: 401,
  description: 'Token ausente, inválido ou expirado (`UNAUTHENTICATED`)',
  content: {
    [JSON_ERROR]: {
      example: {
        statusCode: 401,
        code: 'UNAUTHENTICATED',
        message: 'Não autenticado.',
      },
    },
  },
};

const RESPONSE_403_READ = {
  status: 403,
  description:
    'Sem a permissão `user:read` (`FORBIDDEN`) ou senha provisória pendente (`PASSWORD_CHANGE_REQUIRED`)',
  content: {
    [JSON_ERROR]: {
      example: {
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Você não tem permissão para esta ação.',
      },
    },
  },
};

const RESPONSE_403_WRITE = {
  ...RESPONSE_403_READ,
  description:
    'Sem a permissão `user:write` (`FORBIDDEN`) ou senha provisória pendente (`PASSWORD_CHANGE_REQUIRED`)',
};

const RESPONSE_404 = {
  status: 404,
  description: 'Usuário não encontrado',
  content: {
    [JSON_ERROR]: {
      example: {
        statusCode: 404,
        code: 'USER_NOT_FOUND',
        message: 'Usuário não encontrado',
      },
    },
  },
};

const RESPONSE_400_ID = {
  status: 400,
  description: 'Identificador que não é um UUID (`INVALID_REQUEST`)',
  content: {
    [JSON_ERROR]: {
      example: {
        statusCode: 400,
        code: 'INVALID_REQUEST',
        message: 'Validation failed (uuid is expected)',
      },
    },
  },
};

const EXAMPLE_INVALID_BODY = {
  summary: 'Corpo fora do contrato',
  value: {
    statusCode: 400,
    code: 'INVALID_REQUEST',
    message: 'Requisição inválida',
    fields: [
      {
        field: 'role',
        message:
          'role deve ser um dos valores: admin, content-brief-editor, content-brief-viewer',
      },
    ],
  },
};

const EXAMPLE_WEAK_PASSWORD = {
  summary: 'Senha fora da política',
  value: {
    statusCode: 400,
    code: 'WEAK_PASSWORD',
    message: 'A senha deve ter entre 10 e 128 caracteres.',
  },
};

const EXAMPLE_INVALID_EMAIL = {
  summary: 'E-mail fora do formato',
  value: {
    statusCode: 400,
    code: 'INVALID_EMAIL',
    message: 'Informe um e-mail válido (até 254 caracteres)',
  },
};

const EXAMPLE_INVALID_NAME = {
  summary: 'Nome fora de 1 a 120 caracteres',
  value: {
    statusCode: 400,
    code: 'INVALID_USER_NAME',
    message: 'O nome deve ter entre 1 e 120 caracteres',
  },
};

const EXAMPLE_VERSION_OUTDATED = {
  summary: 'Versão desatualizada',
  value: {
    statusCode: 409,
    code: 'USER_VERSION_OUTDATED',
    message:
      'Este usuário foi alterado por outra pessoa. Recarregue para ver a versão atual.',
  },
};

const EXAMPLE_LAST_ADMIN = {
  summary: 'Último administrador ativo',
  value: {
    statusCode: 409,
    code: 'LAST_ADMIN',
    message:
      'Esta operação deixaria o sistema sem administrador ativo. Cadastre ou reative outro administrador antes.',
  },
};

const EXAMPLE_SELF = {
  summary: 'Operação na própria conta',
  value: {
    statusCode: 409,
    code: 'CANNOT_MODIFY_SELF',
    message:
      'Você não pode desativar nem alterar o papel da sua própria conta.',
  },
};

const NO_STORE = 'no-store';

@ApiTags('users')
@ApiBearerAuth('bearer')
@Controller('users')
export class UserController {
  constructor(
    @Inject(LIST_USERS_QUERY)
    private readonly listUsers: ListUsersQueryInterface,
    @Inject(FIND_USER_BY_ID_QUERY)
    private readonly findUserById: FindUserByIdQueryInterface,
    @Inject(CREATE_USER_USE_CASE)
    private readonly createUser: CreateUserUseCaseInterface,
    @Inject(UPDATE_USER_USE_CASE)
    private readonly updateUser: UpdateUserUseCaseInterface,
    @Inject(DEACTIVATE_USER_USE_CASE)
    private readonly deactivateUser: DeactivateUserUseCaseInterface,
    @Inject(REACTIVATE_USER_USE_CASE)
    private readonly reactivateUser: ReactivateUserUseCaseInterface,
    @Inject(RESET_USER_PASSWORD_USE_CASE)
    private readonly resetUserPassword: ResetUserPasswordUseCaseInterface,
  ) {}

  @Get()
  @Permissions(Permission.UserRead)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar usuários',
    description:
      'Paginado (`{ data, total, page, limit }`), ordenado por nome (colação pt-BR). Busca por nome ou e-mail em `q` e filtro de situação em `status`.',
  })
  @ApiResponse({
    status: 200,
    description: 'Página de usuários (`data` vazio quando nada casa)',
    type: ListUsersResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Parâmetro de consulta inválido (`INVALID_REQUEST`)',
    content: { [JSON_ERROR]: { examples: { body: EXAMPLE_INVALID_BODY } } },
  })
  @ApiResponse(RESPONSE_401)
  @ApiResponse(RESPONSE_403_READ)
  async findAll(
    @Query() query: ListUsersQueryDto,
  ): Promise<ListUsersResponseDto> {
    return toUserListResponse(
      await this.listUsers.execute({
        q: query.q,
        status: query.status,
        page: query.page,
        limit: query.limit,
      }),
    );
  }

  @Get(':id')
  @Permissions(Permission.UserRead)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Detalhar um usuário' })
  @ApiParam({ name: 'id', description: 'Id do usuário (uuid)' })
  @ApiResponse({ status: 200, description: 'Usuário', type: UserResponseDto })
  @ApiResponse(RESPONSE_400_ID)
  @ApiResponse(RESPONSE_401)
  @ApiResponse(RESPONSE_403_READ)
  @ApiResponse(RESPONSE_404)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponseDto> {
    return toUserResponse(await this.findUserById.execute(id));
  }

  @Post()
  @Permissions(Permission.UserWrite)
  @HttpCode(HttpStatus.CREATED)
  @Header('Cache-Control', NO_STORE)
  @ApiOperation({
    summary: 'Criar usuário',
    description:
      'Sem `password`, a API gera uma senha provisória forte e a devolve **uma única vez** em `temporaryPassword`. O usuário nasce com `mustChangePassword = true`.',
  })
  @ApiResponse({
    status: 201,
    description: 'Usuário criado (com a senha provisória, se gerada)',
    type: UserWithTemporaryPasswordResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Corpo inválido, nome, e-mail ou senha fora das regras',
    content: {
      [JSON_ERROR]: {
        examples: {
          body: EXAMPLE_INVALID_BODY,
          name: EXAMPLE_INVALID_NAME,
          email: EXAMPLE_INVALID_EMAIL,
          password: EXAMPLE_WEAK_PASSWORD,
        },
      },
    },
  })
  @ApiResponse(RESPONSE_401)
  @ApiResponse(RESPONSE_403_WRITE)
  @ApiResponse({
    status: 409,
    description: 'E-mail já cadastrado (`EMAIL_ALREADY_REGISTERED`)',
    content: {
      [JSON_ERROR]: {
        example: {
          statusCode: 409,
          code: 'EMAIL_ALREADY_REGISTERED',
          message: 'Já existe um usuário com este e-mail.',
        },
      },
    },
  })
  async create(
    @Body() body: CreateUserRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserWithTemporaryPasswordResponseDto> {
    return toUserWithTemporaryPasswordResponse(
      await this.createUser.execute({
        name: body.name,
        email: body.email,
        role: body.role,
        password: body.password,
        actor: toActor(user),
      }),
    );
  }

  @Patch(':id')
  @Permissions(Permission.UserWrite)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Alterar nome e/ou papel',
    description:
      'Exige a `version` lida (concorrência otimista, ADR-006). O papel não pode ser alterado na própria conta nem no último administrador ativo. O e-mail não muda. A mudança de papel vale nos access tokens novos (até `JWT_ACCESS_TTL` depois nos já emitidos).',
  })
  @ApiParam({ name: 'id', description: 'Id do usuário (uuid)' })
  @ApiResponse({
    status: 200,
    description: 'Usuário alterado',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Corpo, id ou nome inválido (ou nenhum campo para alterar)',
    content: {
      [JSON_ERROR]: {
        examples: { body: EXAMPLE_INVALID_BODY, name: EXAMPLE_INVALID_NAME },
      },
    },
  })
  @ApiResponse(RESPONSE_401)
  @ApiResponse(RESPONSE_403_WRITE)
  @ApiResponse(RESPONSE_404)
  @ApiResponse({
    status: 409,
    description:
      'Versão desatualizada (`USER_VERSION_OUTDATED`), operação na própria conta (`CANNOT_MODIFY_SELF`) ou último administrador (`LAST_ADMIN`)',
    content: {
      [JSON_ERROR]: {
        examples: {
          version: EXAMPLE_VERSION_OUTDATED,
          self: EXAMPLE_SELF,
          lastAdmin: EXAMPLE_LAST_ADMIN,
        },
      },
    },
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateUserRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    return toUserResponse(
      await this.updateUser.execute({
        id,
        name: body.name,
        role: body.role,
        version: body.version,
        actor: toActor(user),
      }),
    );
  }

  @Post(':id/deactivate')
  @Permissions(Permission.UserWrite)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Desativar usuário',
    description:
      'Idempotente. Impede login e renovação de sessão e revoga os refresh tokens. O access token já emitido vale até expirar (no máximo `JWT_ACCESS_TTL`, padrão 15 min). Não vale para a própria conta nem para o último administrador ativo.',
  })
  @ApiParam({ name: 'id', description: 'Id do usuário (uuid)' })
  @ApiResponse({
    status: 200,
    description: 'Usuário desativado (ou já estava)',
    type: UserResponseDto,
  })
  @ApiResponse(RESPONSE_400_ID)
  @ApiResponse(RESPONSE_401)
  @ApiResponse(RESPONSE_403_WRITE)
  @ApiResponse(RESPONSE_404)
  @ApiResponse({
    status: 409,
    description:
      'Própria conta (`CANNOT_MODIFY_SELF`), último administrador (`LAST_ADMIN`) ou alterado por outra pessoa (`USER_VERSION_OUTDATED`)',
    content: {
      [JSON_ERROR]: {
        examples: {
          self: EXAMPLE_SELF,
          lastAdmin: EXAMPLE_LAST_ADMIN,
          version: EXAMPLE_VERSION_OUTDATED,
        },
      },
    },
  })
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    return toUserResponse(
      await this.deactivateUser.execute({ id, actor: toActor(user) }),
    );
  }

  @Post(':id/reactivate')
  @Permissions(Permission.UserWrite)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reativar usuário',
    description: 'Idempotente. Também destrava a conta.',
  })
  @ApiParam({ name: 'id', description: 'Id do usuário (uuid)' })
  @ApiResponse({
    status: 200,
    description: 'Usuário reativado (ou já estava ativo)',
    type: UserResponseDto,
  })
  @ApiResponse(RESPONSE_400_ID)
  @ApiResponse(RESPONSE_401)
  @ApiResponse(RESPONSE_403_WRITE)
  @ApiResponse(RESPONSE_404)
  @ApiResponse({
    status: 409,
    description:
      'Alterado por outra pessoa durante a operação (`USER_VERSION_OUTDATED`)',
    content: {
      [JSON_ERROR]: { examples: { version: EXAMPLE_VERSION_OUTDATED } },
    },
  })
  async reactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    return toUserResponse(
      await this.reactivateUser.execute({ id, actor: toActor(user) }),
    );
  }

  @Post(':id/reset-password')
  @Permissions(Permission.UserWrite)
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', NO_STORE)
  @ApiOperation({
    summary: 'Redefinir a senha',
    description:
      'Gera uma senha provisória forte, devolvida **uma única vez** em `temporaryPassword`. O usuário passa a ter `mustChangePassword = true`, a conta é destravada e todas as sessões (refresh tokens) são revogadas.',
  })
  @ApiParam({ name: 'id', description: 'Id do usuário (uuid)' })
  @ApiResponse({
    status: 200,
    description: 'Senha redefinida (com a nova senha provisória)',
    type: UserWithTemporaryPasswordResponseDto,
  })
  @ApiResponse(RESPONSE_400_ID)
  @ApiResponse(RESPONSE_401)
  @ApiResponse(RESPONSE_403_WRITE)
  @ApiResponse(RESPONSE_404)
  @ApiResponse({
    status: 409,
    description:
      'Alterado por outra pessoa durante a operação (`USER_VERSION_OUTDATED`)',
    content: {
      [JSON_ERROR]: { examples: { version: EXAMPLE_VERSION_OUTDATED } },
    },
  })
  async resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserWithTemporaryPasswordResponseDto> {
    return toUserWithTemporaryPasswordResponse(
      await this.resetUserPassword.execute({ id, actor: toActor(user) }),
    );
  }
}
