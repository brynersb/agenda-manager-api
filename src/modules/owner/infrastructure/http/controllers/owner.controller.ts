import {
  Body,
  Controller,
  Get,
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
  ApiQuery,
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
  LIST_OWNERS_QUERY,
  type ListOwnersQueryInterface,
} from '@/modules/owner/application/queries/list-owners/list-owners.query.interface';
import {
  ARCHIVE_OWNER_USE_CASE,
  type ArchiveOwnerUseCaseInterface,
} from '@/modules/owner/application/use-cases/archive-owner/archive-owner.use-case.interface';
import {
  CREATE_OWNER_USE_CASE,
  type CreateOwnerUseCaseInterface,
} from '@/modules/owner/application/use-cases/create-owner/create-owner.use-case.interface';
import {
  REACTIVATE_OWNER_USE_CASE,
  type ReactivateOwnerUseCaseInterface,
} from '@/modules/owner/application/use-cases/reactivate-owner/reactivate-owner.use-case.interface';
import {
  RENAME_OWNER_USE_CASE,
  type RenameOwnerUseCaseInterface,
} from '@/modules/owner/application/use-cases/rename-owner/rename-owner.use-case.interface';
import { CreateOwnerRequestDto } from '@/modules/owner/infrastructure/http/dtos/create-owner.request.dto';
import { ListRegistriesQueryDto } from '@/modules/owner/infrastructure/http/dtos/list-registries.query.dto';
import { OwnerResponseDto } from '@/modules/owner/infrastructure/http/dtos/owner.response.dto';
import { RenameOwnerRequestDto } from '@/modules/owner/infrastructure/http/dtos/rename-owner.request.dto';
import { toRegistryResponse } from '@/modules/owner/infrastructure/http/presenters/owner.presenter';

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

const RESPONSE_403 = {
  status: 403,
  description: 'Sem a permissão `registry:write` (`FORBIDDEN`)',
  content: {
    [JSON_ERROR]: {
      example: {
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Você não tem permissão para esta operação',
      },
    },
  },
};

const RESPONSE_404 = {
  status: 404,
  description: 'Responsável não encontrado',
  content: {
    [JSON_ERROR]: {
      example: {
        statusCode: 404,
        code: 'OWNER_NOT_FOUND',
        message: 'Responsável não encontrado',
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

const EXAMPLE_INVALID_NAME = {
  summary: 'Nome fora de 1 a 80 caracteres',
  value: {
    statusCode: 400,
    code: 'INVALID_REGISTRY_NAME',
    message: 'O nome deve ter entre 1 e 80 caracteres',
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

const EXAMPLE_INVALID_BODY = {
  summary: 'Corpo fora do contrato',
  value: {
    statusCode: 400,
    code: 'INVALID_REQUEST',
    message: 'Requisição inválida',
    fields: [{ field: 'name', message: 'name deve ser um texto' }],
  },
};

const EXAMPLE_DUPLICATED = {
  summary: 'Já existe outro responsável com este nome',
  value: {
    statusCode: 409,
    code: 'OWNER_NAME_DUPLICATED',
    message: 'Já existe um responsável com este nome.',
  },
};

const EXAMPLE_DUPLICATED_ARCHIVED = {
  summary: 'O homônimo está arquivado',
  value: {
    statusCode: 409,
    code: 'OWNER_NAME_DUPLICATED',
    message:
      'Já existe um responsável arquivado com este nome. Reative-o em vez de criar outro.',
  },
};

const EXAMPLE_VERSION_OUTDATED = {
  summary: 'Versão desatualizada',
  value: {
    statusCode: 409,
    code: 'OWNER_VERSION_OUTDATED',
    message:
      'Este responsável foi alterado por outra pessoa. Recarregue para ver a versão atual.',
  },
};

@ApiTags('owners')
@ApiBearerAuth('bearer')
@Controller('owners')
export class OwnerController {
  constructor(
    @Inject(LIST_OWNERS_QUERY)
    private readonly listOwners: ListOwnersQueryInterface,
    @Inject(CREATE_OWNER_USE_CASE)
    private readonly createOwner: CreateOwnerUseCaseInterface,
    @Inject(RENAME_OWNER_USE_CASE)
    private readonly renameOwner: RenameOwnerUseCaseInterface,
    @Inject(ARCHIVE_OWNER_USE_CASE)
    private readonly archiveOwner: ArchiveOwnerUseCaseInterface,
    @Inject(REACTIVATE_OWNER_USE_CASE)
    private readonly reactivateOwner: ReactivateOwnerUseCaseInterface,
  ) {}

  @Get()
  @Permissions(Permission.RegistryRead)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar responsáveis',
    description:
      'Ordenados por nome (colação pt-BR), no máximo 500. Sem paginação. Arquivados só com `includeArchived=true`.',
  })
  @ApiQuery({
    name: 'includeArchived',
    required: false,
    type: Boolean,
    description: 'Inclui os arquivados (padrão `false`)',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de responsáveis (vazia quando não há nenhum)',
    type: [OwnerResponseDto],
  })
  @ApiResponse({
    status: 400,
    description: '`includeArchived` que não é `true` nem `false`',
    content: { [JSON_ERROR]: { examples: { body: EXAMPLE_INVALID_BODY } } },
  })
  @ApiResponse(RESPONSE_401)
  @ApiResponse({
    ...RESPONSE_403,
    description: 'Sem a permissão `registry:read` (`FORBIDDEN`)',
  })
  async findAll(
    @Query() query: ListRegistriesQueryDto,
  ): Promise<OwnerResponseDto[]> {
    const items = await this.listOwners.execute({
      includeArchived: query.includeArchived,
    });
    return items.map(toRegistryResponse);
  }

  @Post()
  @Permissions(Permission.RegistryWrite)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Criar responsável',
    description:
      'O nome é único ignorando caixa e acento, também entre arquivados.',
  })
  @ApiResponse({
    status: 201,
    description: 'Responsável criado',
    type: OwnerResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Corpo inválido, nome fora de 1 a 80 caracteres ou e-mail inválido',
    content: {
      [JSON_ERROR]: {
        examples: {
          name: EXAMPLE_INVALID_NAME,
          email: EXAMPLE_INVALID_EMAIL,
          body: EXAMPLE_INVALID_BODY,
        },
      },
    },
  })
  @ApiResponse(RESPONSE_401)
  @ApiResponse(RESPONSE_403)
  @ApiResponse({
    status: 409,
    description: 'Nome já em uso (`OWNER_NAME_DUPLICATED`)',
    content: {
      [JSON_ERROR]: {
        examples: {
          duplicated: EXAMPLE_DUPLICATED,
          archived: EXAMPLE_DUPLICATED_ARCHIVED,
        },
      },
    },
  })
  async create(
    @Body() body: CreateOwnerRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OwnerResponseDto> {
    const created = await this.createOwner.execute({
      name: body.name,
      email: body.email,
      actor: toActor(user),
    });
    return toRegistryResponse(created);
  }

  @Patch(':id')
  @Permissions(Permission.RegistryWrite)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Renomear responsável',
    description:
      'Altera o nome e, se `email` vier no corpo, o e-mail (`null` remove). Exige a `version` lida (concorrência otimista, ADR-006).',
  })
  @ApiParam({ name: 'id', description: 'Id do responsável (uuid)' })
  @ApiResponse({
    status: 200,
    description: 'Responsável renomeado',
    type: OwnerResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Corpo, id, nome ou e-mail inválido',
    content: {
      [JSON_ERROR]: {
        examples: {
          name: EXAMPLE_INVALID_NAME,
          email: EXAMPLE_INVALID_EMAIL,
          body: EXAMPLE_INVALID_BODY,
        },
      },
    },
  })
  @ApiResponse(RESPONSE_401)
  @ApiResponse(RESPONSE_403)
  @ApiResponse(RESPONSE_404)
  @ApiResponse({
    status: 409,
    description:
      'Nome já em uso (`OWNER_NAME_DUPLICATED`) ou versão desatualizada (`OWNER_VERSION_OUTDATED`)',
    content: {
      [JSON_ERROR]: {
        examples: {
          duplicated: EXAMPLE_DUPLICATED,
          archived: EXAMPLE_DUPLICATED_ARCHIVED,
          version: EXAMPLE_VERSION_OUTDATED,
        },
      },
    },
  })
  async rename(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RenameOwnerRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OwnerResponseDto> {
    const renamed = await this.renameOwner.execute({
      id,
      name: body.name,
      email: body.email,
      version: body.version,
      actor: toActor(user),
    });
    return toRegistryResponse(renamed);
  }

  @Post(':id/archive')
  @Permissions(Permission.RegistryWrite)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Arquivar responsável',
    description:
      'Idempotente. O responsável sai da lista padrão e do seletor de pauta nova; as pautas existentes continuam mostrando o nome.',
  })
  @ApiParam({ name: 'id', description: 'Id do responsável (uuid)' })
  @ApiResponse({
    status: 200,
    description: 'Responsável arquivado (ou já estava)',
    type: OwnerResponseDto,
  })
  @ApiResponse(RESPONSE_400_ID)
  @ApiResponse(RESPONSE_401)
  @ApiResponse(RESPONSE_403)
  @ApiResponse(RESPONSE_404)
  @ApiResponse({
    status: 409,
    description:
      'Alterado por outra pessoa durante a operação (`OWNER_VERSION_OUTDATED`)',
    content: {
      [JSON_ERROR]: { examples: { version: EXAMPLE_VERSION_OUTDATED } },
    },
  })
  async archive(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OwnerResponseDto> {
    const archived = await this.archiveOwner.execute({
      id,
      actor: toActor(user),
    });
    return toRegistryResponse(archived);
  }

  @Post(':id/reactivate')
  @Permissions(Permission.RegistryWrite)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reativar responsável',
    description: 'Idempotente. Reativar nunca conflita: o nome continua único.',
  })
  @ApiParam({ name: 'id', description: 'Id do responsável (uuid)' })
  @ApiResponse({
    status: 200,
    description: 'Responsável reativado (ou já estava ativo)',
    type: OwnerResponseDto,
  })
  @ApiResponse(RESPONSE_400_ID)
  @ApiResponse(RESPONSE_401)
  @ApiResponse(RESPONSE_403)
  @ApiResponse(RESPONSE_404)
  @ApiResponse({
    status: 409,
    description:
      'Alterado por outra pessoa durante a operação (`OWNER_VERSION_OUTDATED`)',
    content: {
      [JSON_ERROR]: { examples: { version: EXAMPLE_VERSION_OUTDATED } },
    },
  })
  async reactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OwnerResponseDto> {
    const reactivated = await this.reactivateOwner.execute({
      id,
      actor: toActor(user),
    });
    return toRegistryResponse(reactivated);
  }
}
