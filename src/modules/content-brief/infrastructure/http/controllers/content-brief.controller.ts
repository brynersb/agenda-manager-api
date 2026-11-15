import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
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
  FIND_CONTENT_BRIEF_BY_ID_QUERY,
  type FindContentBriefByIdQueryInterface,
} from '@/modules/content-brief/application/queries/find-content-brief-by-id/find-content-brief-by-id.query.interface';
import {
  LIST_CONTENT_BRIEFS_QUERY,
  type ListContentBriefsQueryInterface,
} from '@/modules/content-brief/application/queries/list-content-briefs/list-content-briefs.query.interface';
import {
  SUMMARIZE_CONTENT_BRIEFS_QUERY,
  type SummarizeContentBriefsQueryInterface,
} from '@/modules/content-brief/application/queries/summarize-content-briefs/summarize-content-briefs.query.interface';
import {
  CHANGE_CONTENT_BRIEF_STATUS_USE_CASE,
  type ChangeContentBriefStatusUseCaseInterface,
} from '@/modules/content-brief/application/use-cases/change-content-brief-status/change-content-brief-status.use-case.interface';
import {
  CREATE_CONTENT_BRIEF_USE_CASE,
  type CreateContentBriefUseCaseInterface,
} from '@/modules/content-brief/application/use-cases/create-content-brief/create-content-brief.use-case.interface';
import {
  DELETE_CONTENT_BRIEF_USE_CASE,
  type DeleteContentBriefUseCaseInterface,
} from '@/modules/content-brief/application/use-cases/delete-content-brief/delete-content-brief.use-case.interface';
import {
  UPDATE_CONTENT_BRIEF_USE_CASE,
  type UpdateContentBriefUseCaseInterface,
} from '@/modules/content-brief/application/use-cases/update-content-brief/update-content-brief.use-case.interface';
import { ChangeContentBriefStatusRequestDto } from '@/modules/content-brief/infrastructure/http/dtos/change-content-brief-status.request.dto';
import { ContentBriefResponseDto } from '@/modules/content-brief/infrastructure/http/dtos/content-brief.response.dto';
import { ContentBriefSummaryResponseDto } from '@/modules/content-brief/infrastructure/http/dtos/content-brief-summary.response.dto';
import { CreateContentBriefRequestDto } from '@/modules/content-brief/infrastructure/http/dtos/create-content-brief.request.dto';
import { ListContentBriefsQueryDto } from '@/modules/content-brief/infrastructure/http/dtos/list-content-briefs.query.dto';
import { ListContentBriefsResponseDto } from '@/modules/content-brief/infrastructure/http/dtos/list-content-briefs.response.dto';
import { SummarizeContentBriefsQueryDto } from '@/modules/content-brief/infrastructure/http/dtos/summarize-content-briefs.query.dto';
import { UpdateContentBriefRequestDto } from '@/modules/content-brief/infrastructure/http/dtos/update-content-brief.request.dto';
import {
  toContentBriefListResponse,
  toContentBriefResponse,
} from '@/modules/content-brief/infrastructure/http/presenters/content-brief.presenter';
import { toContentBriefSummaryResponse } from '@/modules/content-brief/infrastructure/http/presenters/content-brief-summary.presenter';

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

const RESPONSE_403_WRITE = {
  status: 403,
  description:
    'Sem a permissão `content-brief:write` (`FORBIDDEN`) ou senha provisória pendente (`PASSWORD_CHANGE_REQUIRED`)',
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
  description: 'Pauta não encontrada ou excluída (`CONTENT_BRIEF_NOT_FOUND`)',
  content: {
    [JSON_ERROR]: {
      example: {
        statusCode: 404,
        code: 'CONTENT_BRIEF_NOT_FOUND',
        message: 'Pauta não encontrada',
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
      { field: 'dueDate', message: 'Informe o prazo no formato AAAA-MM-DD' },
    ],
  },
};

const EXAMPLE_INVALID_TITLE = {
  summary: 'Título fora de 1 a 140 caracteres',
  value: {
    statusCode: 400,
    code: 'INVALID_TITLE',
    message: 'O título deve ter entre 1 e 140 caracteres',
  },
};

const EXAMPLE_INVALID_DESCRIPTION = {
  summary: 'Descrição acima de 1200 caracteres',
  value: {
    statusCode: 400,
    code: 'INVALID_DESCRIPTION',
    message: 'A descrição deve ter no máximo 1200 caracteres',
  },
};

const EXAMPLE_INVALID_DUE_DATE = {
  summary: 'Prazo que não é uma data existente',
  value: {
    statusCode: 400,
    code: 'INVALID_REQUEST',
    message:
      'Prazo inválido: "2026-02-30". Use uma data existente no formato YYYY-MM-DD',
  },
};

const EXAMPLE_ESTATE_DEVELOPMENT_UNAVAILABLE = {
  summary: 'Empreendimento arquivado ou inexistente',
  value: {
    statusCode: 400,
    code: 'ESTATE_DEVELOPMENT_UNAVAILABLE',
    message:
      'O empreendimento está arquivado e não pode ser atribuído a uma pauta',
  },
};

const EXAMPLE_OWNER_UNAVAILABLE = {
  summary: 'Responsável arquivado ou inexistente',
  value: {
    statusCode: 400,
    code: 'OWNER_UNAVAILABLE',
    message:
      'O responsável está arquivado e não pode ser atribuído a uma pauta',
  },
};

const EXAMPLE_VERSION_OUTDATED = {
  summary: 'Versão desatualizada',
  value: {
    statusCode: 409,
    code: 'CONTENT_BRIEF_VERSION_OUTDATED',
    message:
      'Esta pauta foi alterada por outra pessoa. Recarregue para ver a versão atual.',
  },
};

const RESPONSE_409 = {
  status: 409,
  description:
    'Versão desatualizada: a pauta foi alterada por outra pessoa (`CONTENT_BRIEF_VERSION_OUTDATED`)',
  content: {
    [JSON_ERROR]: { examples: { version: EXAMPLE_VERSION_OUTDATED } },
  },
};

const EXAMPLE_INVALID_QUERY = {
  summary: 'Filtro fora do contrato',
  value: {
    statusCode: 400,
    code: 'INVALID_REQUEST',
    message: 'Requisição inválida',
    fields: [
      { field: 'limit', message: 'limit deve ser menor ou igual a 200' },
      {
        field: 'dueStatus',
        message:
          'dueStatus deve ser um dos valores: overdue, today, next-7-days, later, no-due-date, completed',
      },
      {
        field: 'q',
        message: 'A busca deve ter entre 2 e 100 caracteres',
      },
    ],
  },
};

const RESPONSE_400_QUERY = {
  status: 400,
  description:
    'Parâmetro fora do contrato: `limit` acima de 200, valor de enum ou CSV inválido, uuid malformado, `q` fora de 2 a 100 caracteres (`INVALID_REQUEST` com `fields`)',
  content: { [JSON_ERROR]: { examples: { query: EXAMPLE_INVALID_QUERY } } },
};

const WRITE_VALIDATION_EXAMPLES = {
  body: EXAMPLE_INVALID_BODY,
  title: EXAMPLE_INVALID_TITLE,
  description: EXAMPLE_INVALID_DESCRIPTION,
  dueDate: EXAMPLE_INVALID_DUE_DATE,
  estateDevelopment: EXAMPLE_ESTATE_DEVELOPMENT_UNAVAILABLE,
  owner: EXAMPLE_OWNER_UNAVAILABLE,
};

/** Pautas de marketing: escrita, listagem, resumo e leitura por id (`/api/v1/content-briefs`). */
@ApiTags('content-briefs')
@ApiBearerAuth('bearer')
@Controller('content-briefs')
export class ContentBriefController {
  constructor(
    @Inject(CREATE_CONTENT_BRIEF_USE_CASE)
    private readonly createContentBrief: CreateContentBriefUseCaseInterface,
    @Inject(UPDATE_CONTENT_BRIEF_USE_CASE)
    private readonly updateContentBrief: UpdateContentBriefUseCaseInterface,
    @Inject(CHANGE_CONTENT_BRIEF_STATUS_USE_CASE)
    private readonly changeContentBriefStatus: ChangeContentBriefStatusUseCaseInterface,
    @Inject(DELETE_CONTENT_BRIEF_USE_CASE)
    private readonly deleteContentBrief: DeleteContentBriefUseCaseInterface,
    @Inject(FIND_CONTENT_BRIEF_BY_ID_QUERY)
    private readonly findContentBriefById: FindContentBriefByIdQueryInterface,
    @Inject(LIST_CONTENT_BRIEFS_QUERY)
    private readonly listContentBriefs: ListContentBriefsQueryInterface,
    @Inject(SUMMARIZE_CONTENT_BRIEFS_QUERY)
    private readonly summarizeContentBriefs: SummarizeContentBriefsQueryInterface,
  ) {}

  @Post()
  @Permissions(Permission.ContentBriefWrite)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Criar pauta',
    description:
      'O status padrão é `TODO`. Empreendimento e responsável, quando informados, precisam existir e estar ativos. Criar já em `DONE` grava `completedAt`.',
  })
  @ApiResponse({
    status: 201,
    description: 'Pauta criada',
    type: ContentBriefResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Corpo inválido, título ou descrição fora do limite, prazo inexistente, empreendimento ou responsável indisponível',
    content: { [JSON_ERROR]: { examples: WRITE_VALIDATION_EXAMPLES } },
  })
  @ApiResponse(RESPONSE_401)
  @ApiResponse(RESPONSE_403_WRITE)
  async create(
    @Body() body: CreateContentBriefRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ContentBriefResponseDto> {
    const created = await this.createContentBrief.execute({
      title: body.title,
      description: body.description ?? null,
      dueDate: body.dueDate ?? null,
      status: body.status ?? null,
      action: body.action ?? null,
      channel: body.channel ?? null,
      estateDevelopmentId: body.estateDevelopmentId ?? null,
      ownerId: body.ownerId ?? null,
      actor: toActor(user),
    });
    return toContentBriefResponse(created);
  }

  @Get()
  @Permissions(Permission.ContentBriefRead)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar pautas',
    description:
      'Pautas não excluídas, paginadas (`page` 1, `limit` 50, máximo 200). `dueStatus` e `status` são CSV com `OR` entre os valores; os filtros diferentes combinam com `AND`. A situação do prazo é calculada em SQL com "hoje" no fuso da operação (nunca no cliente) e cada item traz `dueStatus` e `daysUntilDue` do mesmo "hoje". `sort`: `dueDate` (padrão), `-dueDate` ou `updatedAt`; sem prazo por último, desempate por título (pt-BR). Lista vazia responde 200 com `data: []`.',
  })
  @ApiResponse({
    status: 200,
    description: 'Página de pautas: `{ data, total, page, limit }`',
    type: ListContentBriefsResponseDto,
  })
  @ApiResponse(RESPONSE_400_QUERY)
  @ApiResponse(RESPONSE_401)
  @ApiResponse({
    ...RESPONSE_403_WRITE,
    description:
      'Sem a permissão `content-brief:read` (`FORBIDDEN`) ou senha provisória pendente (`PASSWORD_CHANGE_REQUIRED`)',
  })
  async findAll(
    @Query() query: ListContentBriefsQueryDto,
  ): Promise<ListContentBriefsResponseDto> {
    const result = await this.listContentBriefs.execute({
      dueStatus: query.dueStatus,
      status: query.status,
      estateDevelopmentId: query.estateDevelopmentId,
      ownerId: query.ownerId,
      action: query.action,
      q: query.q,
      sort: query.sort,
      page: query.page,
      limit: query.limit,
    });
    return toContentBriefListResponse(result);
  }

  // Declarada antes de `GET :id`: senão "summary" seria lido como id.
  @Get('summary')
  @Permissions(Permission.ContentBriefRead)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resumir pautas',
    description:
      'Contagens para os filtros rápidos e as colunas da tela, numa única consulta: total, por situação do prazo e por status, com **todas** as chaves (zero quando vazio). Aplica os mesmos `status`, `estateDevelopmentId`, `ownerId`, `action` e `q` da listagem; `dueStatus`, `page`, `limit` e `sort` são aceitos e ignorados. `today` é o dia de referência (`YYYY-MM-DD`, `APP_TIMEZONE`).',
  })
  @ApiResponse({
    status: 200,
    description: 'Contagens das pautas que casam com os filtros comuns',
    type: ContentBriefSummaryResponseDto,
  })
  @ApiResponse(RESPONSE_400_QUERY)
  @ApiResponse(RESPONSE_401)
  @ApiResponse({
    ...RESPONSE_403_WRITE,
    description:
      'Sem a permissão `content-brief:read` (`FORBIDDEN`) ou senha provisória pendente (`PASSWORD_CHANGE_REQUIRED`)',
  })
  async summarize(
    @Query() query: SummarizeContentBriefsQueryDto,
  ): Promise<ContentBriefSummaryResponseDto> {
    const summary = await this.summarizeContentBriefs.execute({
      status: query.status,
      estateDevelopmentId: query.estateDevelopmentId,
      ownerId: query.ownerId,
      action: query.action,
      q: query.q,
    });
    return toContentBriefSummaryResponse(summary);
  }

  @Get(':id')
  @Permissions(Permission.ContentBriefRead)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Detalhar pauta',
    description:
      'Inclui a situação do prazo (`dueStatus`, `daysUntilDue`) calculada para "hoje" no fuso da operação, os nomes do empreendimento e do responsável (mesmo arquivados) e a auditoria. Pauta excluída responde 404.',
  })
  @ApiParam({ name: 'id', description: 'Id da pauta (uuid)' })
  @ApiResponse({
    status: 200,
    description: 'Pauta',
    type: ContentBriefResponseDto,
  })
  @ApiResponse(RESPONSE_400_ID)
  @ApiResponse(RESPONSE_401)
  @ApiResponse({
    ...RESPONSE_403_WRITE,
    description:
      'Sem a permissão `content-brief:read` (`FORBIDDEN`) ou senha provisória pendente (`PASSWORD_CHANGE_REQUIRED`)',
  })
  @ApiResponse(RESPONSE_404)
  async findOneById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ContentBriefResponseDto> {
    const contentBrief = await this.findContentBriefById.execute({ id });
    return toContentBriefResponse(contentBrief);
  }

  @Put(':id')
  @Permissions(Permission.ContentBriefWrite)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Editar pauta (substituição completa)',
    description:
      'Campo ausente **não** mantém o valor atual: limpa (descrição vira vazia; prazo, ação, canal, empreendimento e responsável viram `null`). Só `status` ausente mantém o atual. Envie sempre todos os campos, mais a `version` lida (concorrência otimista, ADR-006). Empreendimento e responsável só são validados quando trocados: manter um que foi arquivado depois é permitido.',
  })
  @ApiParam({ name: 'id', description: 'Id da pauta (uuid)' })
  @ApiResponse({
    status: 200,
    description: 'Pauta editada, com a nova `version`',
    type: ContentBriefResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Id ou corpo inválido, título ou descrição fora do limite, prazo inexistente, empreendimento ou responsável indisponível',
    content: { [JSON_ERROR]: { examples: WRITE_VALIDATION_EXAMPLES } },
  })
  @ApiResponse(RESPONSE_401)
  @ApiResponse(RESPONSE_403_WRITE)
  @ApiResponse(RESPONSE_404)
  @ApiResponse(RESPONSE_409)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateContentBriefRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ContentBriefResponseDto> {
    const updated = await this.updateContentBrief.execute({
      id,
      title: body.title,
      description: body.description ?? null,
      dueDate: body.dueDate ?? null,
      status: body.status ?? null,
      action: body.action ?? null,
      channel: body.channel ?? null,
      estateDevelopmentId: body.estateDevelopmentId ?? null,
      ownerId: body.ownerId ?? null,
      version: body.version,
      actor: toActor(user),
    });
    return toContentBriefResponse(updated);
  }

  @Patch(':id/status')
  @Permissions(Permission.ContentBriefWrite)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trocar o status da pauta',
    description:
      'A troca é livre entre `TODO`, `IN_PROGRESS`, `IN_REVIEW` e `DONE`. Entrar em `DONE` grava `completedAt`; sair limpa. Exige a `version` lida e devolve a pauta com a nova `version` (o front faz troca otimista).',
  })
  @ApiParam({ name: 'id', description: 'Id da pauta (uuid)' })
  @ApiResponse({
    status: 200,
    description: 'Pauta com o novo status e a nova `version`',
    type: ContentBriefResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Id ou corpo inválido (status fora do enum, `version` ausente)',
    content: { [JSON_ERROR]: { examples: { body: EXAMPLE_INVALID_BODY } } },
  })
  @ApiResponse(RESPONSE_401)
  @ApiResponse(RESPONSE_403_WRITE)
  @ApiResponse(RESPONSE_404)
  @ApiResponse(RESPONSE_409)
  async changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ChangeContentBriefStatusRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ContentBriefResponseDto> {
    const changed = await this.changeContentBriefStatus.execute({
      id,
      status: body.status,
      version: body.version,
      actor: toActor(user),
    });
    return toContentBriefResponse(changed);
  }

  @Delete(':id')
  @Permissions(Permission.ContentBriefDelete)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Excluir pauta',
    description:
      'Exclusão lógica: a pauta some das consultas (passa a responder 404) mas continua no banco com quem excluiu e quando. Não exige `version`.',
  })
  @ApiParam({ name: 'id', description: 'Id da pauta (uuid)' })
  @ApiResponse({ status: 204, description: 'Pauta excluída' })
  @ApiResponse(RESPONSE_400_ID)
  @ApiResponse(RESPONSE_401)
  @ApiResponse({
    ...RESPONSE_403_WRITE,
    description:
      'Sem a permissão `content-brief:delete` (`FORBIDDEN`) ou senha provisória pendente (`PASSWORD_CHANGE_REQUIRED`)',
  })
  @ApiResponse(RESPONSE_404)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.deleteContentBrief.execute({ id, actor: toActor(user) });
  }
}
