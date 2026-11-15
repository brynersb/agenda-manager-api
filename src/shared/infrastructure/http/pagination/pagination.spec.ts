import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { toPageResponse } from '@/shared/infrastructure/http/pagination/page.response';
import { PaginationQueryDto } from '@/shared/infrastructure/http/pagination/pagination-query.dto';

function validateConfig(query: Record<string, unknown>) {
  const dto = plainToInstance(PaginationQueryDto, query);
  return { dto, errors: validateSync(dto) };
}

describe('PaginationQueryDto', () => {
  it('usa page=1 e limit=50 por padrão', () => {
    const { dto, errors } = validateConfig({});

    expect(errors).toHaveLength(0);
    expect(dto).toMatchObject({ page: 1, limit: 50 });
  });

  it('converte strings da query em números', () => {
    const { dto, errors } = validateConfig({ page: '3', limit: '200' });

    expect(errors).toHaveLength(0);
    expect(dto).toMatchObject({ page: 3, limit: 200 });
  });

  it.each([
    { page: '0' },
    { page: '100001' },
    { page: '1e20' },
    { limit: '0' },
    { limit: '201' },
    { page: 'x' },
  ])('recusa %o', (query) => {
    expect(validateConfig(query).errors.length).toBeGreaterThan(0);
  });
});

describe('toPageResponse', () => {
  it('monta { data, total, page, limit }', () => {
    expect(toPageResponse(['a'], 10, 2, 5)).toEqual({
      data: ['a'],
      total: 10,
      page: 2,
      limit: 5,
    });
  });

  it('mantém data vazio quando não há itens', () => {
    expect(toPageResponse([], 0, 1, 50).data).toEqual([]);
  });
});
