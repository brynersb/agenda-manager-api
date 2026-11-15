import { FindUserByIdQuery } from '@/modules/user/application/queries/find-user-by-id/find-user-by-id.query';
import { UserNotFoundError } from '@/modules/user/domain/errors/user.errors';
import {
  fakeUserQueryRepository,
  makeUser,
  readModelOf,
} from '@/modules/user/testing/user.fixtures';

describe('FindUserByIdQuery', () => {
  const queryRepository = fakeUserQueryRepository();
  const query = new FindUserByIdQuery(queryRepository);

  it('devolve o read model', async () => {
    const model = readModelOf(makeUser({ id: 'u-1' }));
    queryRepository.findOneById.mockResolvedValue(model);

    await expect(query.execute('u-1')).resolves.toBe(model);
  });

  it('inexistente dá USER_NOT_FOUND', async () => {
    queryRepository.findOneById.mockResolvedValue(null);

    await expect(query.execute('x')).rejects.toBeInstanceOf(UserNotFoundError);
  });
});
