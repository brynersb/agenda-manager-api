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
  LIST_ESTATE_DEVELOPMENTS_QUERY,
  type ListEstateDevelopmentsQueryInterface,
} from '@/modules/estate-development/application/queries/list-estate-developments/list-estate-developments.query.interface';
import {
  ARCHIVE_ESTATE_DEVELOPMENT_USE_CASE,
  type ArchiveEstateDevelopmentUseCaseInterface,
} from '@/modules/estate-development/application/use-cases/archive-estate-development/archive-estate-development.use-case.interface';
import {
  CREATE_ESTATE_DEVELOPMENT_USE_CASE,
  type CreateEstateDevelopmentUseCaseInterface,
} from '@/modules/estate-development/application/use-cases/create-estate-development/create-estate-development.use-case.interface';
import {
  REACTIVATE_ESTATE_DEVELOPMENT_USE_CASE,
  type ReactivateEstateDevelopmentUseCaseInterface,
} from '@/modules/estate-development/application/use-cases/reactivate-estate-development/reactivate-estate-development.use-case.interface';
import {
  RENAME_ESTATE_DEVELOPMENT_USE_CASE,
  type RenameEstateDevelopmentUseCaseInterface,
} from '@/modules/estate-development/application/use-cases/rename-estate-development/rename-estate-development.use-case.interface';
import { CreateEstateDevelopmentRequestDto } from '@/modules/estate-development/infrastructure/http/dtos/create-estate-development.request.dto';
import { EstateDevelopmentResponseDto } from '@/modules/estate-development/infrastructure/http/dtos/estate-development.response.dto';
import { ListRegistriesQueryDto } from '@/modules/estate-development/infrastructure/http/dtos/list-registries.query.dto';
import { RenameEstateDevelopmentRequestDto } from '@/modules/estate-development/infrastructure/http/dtos/rename-estate-development.request.dto';
import { toRegistryResponse } from '@/modules/estate-development/infrastructure/http/presenters/estate-development.presenter';

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
  description:
    'Sem a permissão `registry:write` (`FORBIDDEN`) ou senha provisória pendente (`PASSWORD_CHANGE_REQUIRED`)',
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
  description: 'Empreendimento não encontrado',
  content: {
    [JSON_ERROR]: {
      example: {
        statusCode: 404,
        code: 'ESTATE_DEVELOPMENT_NOT_FOUND',
        message: 'Empreendimento não encontrado',
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
  summary: 'Já existe outro empreendimento com este nome',
  value: {
    statusCode: 409,
    code: 'ESTATE_DEVELOPMENT_NAME_DUPLICATED',
    message: 'Já existe um empreendimento com este nome.',
  },
};

const EXAMPLE_DUPLICATED_ARCHIVED = {
  summary: 'O homônimo está arquivado',
  value: {
    statusCode: 409,
    code: 'ESTATE_DEVELOPMENT_NAME_DUPLICATED',
    message:
      'Já existe um empreendimento arquivado com este nome. Reative-o em vez de criar outro.',
  },
};

const EXAMPLE_VERSION_OUTDATED = {
  summary: 'Versão desatualizada',
  value: {
    statusCode: 409,
    code: 'ESTATE_DEVELOPMENT_VERSION_OUTDATED',
    message:
      'Este empreendimento foi alterado por outra pessoa. Recarregue para ver a versão atual.',
  },
};

@ApiTags('estate-developments')
@ApiBearerAuth('bearer')
@Controller('estate-developments')
export class EstateDevelopmentController {
  constructor(
    @Inject(LIST_ESTATE_DEVELOPMENTS_QUERY)
    private readonly listEstateDevelopments: ListEstateDevelopmentsQueryInterface,
    @Inject(CREATE_ESTATE_DEVELOPMENT_USE_CASE)
    private readonly createEstateDevelopment: CreateEstateDevelopmentUseCaseInterface,
    @Inject(RENAME_ESTATE_DEVELOPMENT_USE_CASE)
    private readonly renameEstateDevelopment: RenameEstateDevelopmentUseCaseInterface,
    @Inject(ARCHIVE_ESTATE_DEVELOPMENT_USE_CASE)
    private readonly archiveEstateDevelopment: ArchiveEstateDevelopmentUseCaseInterface,
    @Inject(REACTIVATE_ESTATE_DEVELOPMENT_USE_CASE)
    private readonly reactivateEstateDevelopment: ReactivateEstateDevelopmentUseCaseInterface,
  ) {}

  @Get()
  @Permissions(Permission.RegistryRead)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar empreendimentos',
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
    description: 'Lista de empreendimentos (vazia quando não há nenhum)',
    type: [EstateDevelopmentResponseDto],
  })
  @ApiResponse({
    status: 400,
    description: '`includeArchived` que não é `true` nem `false`',
    content: { [JSON_ERROR]: { examples: { body: EXAMPLE_INVALID_BODY } } },
  })
  @ApiResponse(RESPONSE_401)
  @ApiResponse({
    ...RESPONSE_403,
    description:
      'Sem a permissão `registry:read` (`FORBIDDEN`) ou senha provisória pendente (`PASSWORD_CHANGE_REQUIRED`)',
  })
  async findAll(
    @Query() query: ListRegistriesQueryDto,
  ): Promise<EstateDevelopmentResponseDto[]> {
    const items = await this.listEstateDevelopments.execute({
      includeArchived: query.includeArchived,
    });
    return items.map(toRegistryResponse);
  }

  @Post()
  @Permissions(Permission.RegistryWrite)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Criar empreendimento',
    description:
      'O nome é único ignorando caixa e acento, também entre arquivados.',
  })
  @ApiResponse({
    status: 201,
    description: 'Empreendimento criado',
    type: EstateDevelopmentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Corpo inválido ou nome fora de 1 a 80 caracteres',
    content: {
      [JSON_ERROR]: {
        examples: {
          name: EXAMPLE_INVALID_NAME,
          body: EXAMPLE_INVALID_BODY,
        },
      },
    },
  })
  @ApiResponse(RESPONSE_401)
  @ApiResponse(RESPONSE_403)
  @ApiResponse({
    status: 409,
    description: 'Nome já em uso (`ESTATE_DEVELOPMENT_NAME_DUPLICATED`)',
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
    @Body() body: CreateEstateDevelopmentRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EstateDevelopmentResponseDto> {
    const created = await this.createEstateDevelopment.execute({
      name: body.name,
      actor: toActor(user),
    });
    return toRegistryResponse(created);
  }

  @Patch(':id')
  @Permissions(Permission.RegistryWrite)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Renomear empreendimento',
    description: 'Exige a `version` lida (concorrência otimista, ADR-006).',
  })
  @ApiParam({ name: 'id', description: 'Id do empreendimento (uuid)' })
  @ApiResponse({
    status: 200,
    description: 'Empreendimento renomeado',
    type: EstateDevelopmentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Corpo, id ou nome inválido',
    content: {
      [JSON_ERROR]: {
        examples: {
          name: EXAMPLE_INVALID_NAME,
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
      'Nome já em uso (`ESTATE_DEVELOPMENT_NAME_DUPLICATED`) ou versão desatualizada (`ESTATE_DEVELOPMENT_VERSION_OUTDATED`)',
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
    @Body() body: RenameEstateDevelopmentRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EstateDevelopmentResponseDto> {
    const renamed = await this.renameEstateDevelopment.execute({
      id,
      name: body.name,
      version: body.version,
      actor: toActor(user),
    });
    return toRegistryResponse(renamed);
  }

  @Post(':id/archive')
  @Permissions(Permission.RegistryWrite)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Arquivar empreendimento',
    description:
      'Idempotente. O empreendimento sai da lista padrão e do seletor de pauta nova; as pautas existentes continuam mostrando o nome.',
  })
  @ApiParam({ name: 'id', description: 'Id do empreendimento (uuid)' })
  @ApiResponse({
    status: 200,
    description: 'Empreendimento arquivado (ou já estava)',
    type: EstateDevelopmentResponseDto,
  })
  @ApiResponse(RESPONSE_400_ID)
  @ApiResponse(RESPONSE_401)
  @ApiResponse(RESPONSE_403)
  @ApiResponse(RESPONSE_404)
  @ApiResponse({
    status: 409,
    description:
      'Alterado por outra pessoa durante a operação (`ESTATE_DEVELOPMENT_VERSION_OUTDATED`)',
    content: {
      [JSON_ERROR]: { examples: { version: EXAMPLE_VERSION_OUTDATED } },
    },
  })
  async archive(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EstateDevelopmentResponseDto> {
    const archived = await this.archiveEstateDevelopment.execute({
      id,
      actor: toActor(user),
    });
    return toRegistryResponse(archived);
  }

  @Post(':id/reactivate')
  @Permissions(Permission.RegistryWrite)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reativar empreendimento',
    description: 'Idempotente. Reativar nunca conflita: o nome continua único.',
  })
  @ApiParam({ name: 'id', description: 'Id do empreendimento (uuid)' })
  @ApiResponse({
    status: 200,
    description: 'Empreendimento reativado (ou já estava ativo)',
    type: EstateDevelopmentResponseDto,
  })
  @ApiResponse(RESPONSE_400_ID)
  @ApiResponse(RESPONSE_401)
  @ApiResponse(RESPONSE_403)
  @ApiResponse(RESPONSE_404)
  @ApiResponse({
    status: 409,
    description:
      'Alterado por outra pessoa durante a operação (`ESTATE_DEVELOPMENT_VERSION_OUTDATED`)',
    content: {
      [JSON_ERROR]: { examples: { version: EXAMPLE_VERSION_OUTDATED } },
    },
  })
  async reactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EstateDevelopmentResponseDto> {
    const reactivated = await this.reactivateEstateDevelopment.execute({
      id,
      actor: toActor(user),
    });
    return toRegistryResponse(reactivated);
  }
}
