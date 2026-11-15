import { ListUsersQuery } from '@/modules/user/application/queries/list-users/list-users.query';
import { UserStatus } from '@/modules/user/domain/enums/user-status';
import {
  fakeUserQueryRepository,
  makeUser,
  readModelOf,
} from '@/modules/user/testing/user.fixtures';

describe('ListUsersQuery', () => {
  const queryRepository = fakeUserQueryRepository();
  const query = new ListUsersQuery(queryRepository);

  it('repassa filtros e página e devolve { data, total, page, limit }', async () => {
    const items = [readModelOf(makeUser())];
    queryRepository.findAll.mockResolvedValue({ items, total: 41 });

    const result = await query.execute({
      q: 'maria',
      status: UserStatus.ACTIVE,
      page: 2,
      limit: 20,
    });

    expect(queryRepository.findAll).toHaveBeenCalledWith({
      searchTerm: 'maria',
      status: UserStatus.ACTIVE,
      page: 2,
      limit: 20,
    });
    expect(result).toEqual({ data: items, total: 41, page: 2, limit: 20 });
  });

  it('lista vazia continua válida', async () => {
    queryRepository.findAll.mockResolvedValue({ items: [], total: 0 });

    await expect(query.execute({ page: 1, limit: 50 })).resolves.toEqual({
      data: [],
      total: 0,
      page: 1,
      limit: 50,
    });
  });
});
