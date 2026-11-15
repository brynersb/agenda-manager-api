import type { ArgumentMetadata, BadRequestException } from '@nestjs/common';

import { ContentBriefAction } from '@/modules/content-brief/domain/enums/content-brief-action';
import { ContentBriefSort } from '@/modules/content-brief/domain/enums/content-brief-sort';
import { ContentBriefStatus } from '@/modules/content-brief/domain/enums/content-brief-status';
import { DueStatus } from '@/modules/content-brief/domain/enums/due-status';
import { ListContentBriefsQueryDto } from '@/modules/content-brief/infrastructure/http/dtos/list-content-briefs.query.dto';
import { SummarizeContentBriefsQueryDto } from '@/modules/content-brief/infrastructure/http/dtos/summarize-content-briefs.query.dto';
import { createValidationPipe } from '@/shared/infrastructure/http/validation.pipe';

const UUID = '0192f6a0-7c1e-7a3b-9d52-4f1e8b6c2a10';

/** Passa a query pelo mesmo `ValidationPipe` global da aplicação. */
async function parse<T>(
  metatype: new () => T,
  query: Record<string, unknown>,
): Promise<T> {
  const metadata: ArgumentMetadata = { type: 'query', metatype };
  return (await createValidationPipe().transform(query, metadata)) as T;
}

async function fieldsOf(
  metatype: new () => unknown,
  query: Record<string, unknown>,
): Promise<{ field: string; message: string }[]> {
  try {
    await parse(metatype, query);
  } catch (error) {
    const body = (error as BadRequestException).getResponse() as {
      fields: { field: string; message: string }[];
    };
    return body.fields;
  }
  throw new Error('A query deveria ser recusada');
}

describe('ListContentBriefsQueryDto', () => {
  it('sem parâmetros: page 1, limit 50, sort dueDate e nenhum filtro', async () => {
    const dto = await parse(ListContentBriefsQueryDto, {});

    expect(dto).toMatchObject({
      page: 1,
      limit: 50,
      sort: ContentBriefSort.DUE_DATE,
    });
    expect(dto.dueStatus).toBeUndefined();
    expect(dto.status).toBeUndefined();
    expect(dto.q).toBeUndefined();
  });

  it('converte CSV em listas e números em número', async () => {
    const dto = await parse(ListContentBriefsQueryDto, {
      dueStatus: 'overdue, today,next-7-days',
      status: 'TODO,IN_PROGRESS',
      estateDevelopmentId: UUID,
      ownerId: 'none',
      action: 'CHASE',
      q: '  plantao ',
      sort: '-dueDate',
      page: '2',
      limit: '200',
    });

    expect(dto).toMatchObject({
      dueStatus: [DueStatus.OVERDUE, DueStatus.TODAY, DueStatus.NEXT_7_DAYS],
      status: [ContentBriefStatus.TODO, ContentBriefStatus.IN_PROGRESS],
      estateDevelopmentId: UUID,
      ownerId: 'none',
      action: ContentBriefAction.CHASE,
      q: 'plantao',
      sort: ContentBriefSort.DUE_DATE_DESC,
      page: 2,
      limit: 200,
    });
  });

  it('CSV repete valor? deduplica; vazio ou só vírgulas vira filtro ausente', async () => {
    const dto = await parse(ListContentBriefsQueryDto, {
      dueStatus: 'today,today',
      status: ',',
    });

    expect(dto.dueStatus).toEqual([DueStatus.TODAY]);
    expect(dto.status).toBeUndefined();
  });

  it('aceita o parâmetro repetido (?dueStatus=a&dueStatus=b)', async () => {
    const dto = await parse(ListContentBriefsQueryDto, {
      dueStatus: ['overdue', 'later'],
    });

    expect(dto.dueStatus).toEqual([DueStatus.OVERDUE, DueStatus.LATER]);
  });

  it.each([
    ['dueStatus', { dueStatus: 'overdue,foo' }],
    ['status', { status: 'A_FAZER' }],
    ['estateDevelopmentId', { estateDevelopmentId: 'abc' }],
    ['ownerId', { ownerId: 'abc' }],
    ['action', { action: 'COBRAR' }],
    ['sort', { sort: 'title' }],
    ['q', { q: 'a' }],
    ['q', { q: '   ' }],
    ['q', { q: 'x'.repeat(101) }],
    ['limit', { limit: '201' }],
    ['limit', { limit: '0' }],
    ['page', { page: '0' }],
  ])('recusa %s inválido com o campo em `fields`', async (field, query) => {
    const fields = await fieldsOf(ListContentBriefsQueryDto, query);

    expect(fields.map((item) => item.field)).toContain(field);
  });

  it('mensagens em pt-BR', async () => {
    const [q] = await fieldsOf(ListContentBriefsQueryDto, { q: 'a' });
    const [owner] = await fieldsOf(ListContentBriefsQueryDto, { ownerId: 'x' });

    expect(q?.message).toBe('A busca deve ter entre 2 e 100 caracteres');
    expect(owner?.message).toBe('Informe um UUID válido ou "none"');
  });

  it('parâmetro desconhecido é recusado (whitelist)', async () => {
    const fields = await fieldsOf(ListContentBriefsQueryDto, { foo: '1' });

    expect(fields[0]?.field).toBe('foo');
  });

  it('q com 2 e com 100 caracteres passa', async () => {
    await expect(
      parse(ListContentBriefsQueryDto, { q: 'ab' }),
    ).resolves.toMatchObject({ q: 'ab' });
    await expect(
      parse(ListContentBriefsQueryDto, { q: 'x'.repeat(100) }),
    ).resolves.toBeDefined();
  });
});

describe('SummarizeContentBriefsQueryDto', () => {
  it('aceita e ignora dueStatus, page, limit e sort', async () => {
    const dto = await parse(SummarizeContentBriefsQueryDto, {
      dueStatus: 'overdue',
      page: '2',
      limit: '5',
      sort: '-dueDate',
      status: 'DONE',
    });

    expect(dto.status).toEqual([ContentBriefStatus.DONE]);
  });

  it('valida os filtros comuns', async () => {
    const fields = await fieldsOf(SummarizeContentBriefsQueryDto, {
      status: 'X',
      q: 'a',
    });

    expect(fields.map((item) => item.field).sort()).toEqual(['q', 'status']);
  });
});
