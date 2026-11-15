import type { UserQueryRepositoryInterface } from '@/modules/user/application/interfaces/repositories/user-query.repository.interface';
import type {
  ListUsersInput,
  ListUsersQueryInterface,
  ListUsersResult,
} from './list-users.query.interface';

/** Lista os usuários de uma página, com busca por nome/e-mail e filtro de situação. */
export class ListUsersQuery implements ListUsersQueryInterface {
  constructor(private readonly queryRepository: UserQueryRepositoryInterface) {}

  async execute(input: ListUsersInput): Promise<ListUsersResult> {
    const { items, total } = await this.queryRepository.findAll({
      searchTerm: input.q,
      status: input.status,
      page: input.page,
      limit: input.limit,
    });
    return { data: items, total, page: input.page, limit: input.limit };
  }
}
