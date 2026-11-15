import type {
  UserQueryRepositoryInterface,
  UserReadModel,
} from '@/modules/user/application/interfaces/repositories/user-query.repository.interface';
import { UserNotFoundError } from '@/modules/user/domain/errors/user.errors';
import type { FindUserByIdQueryInterface } from './find-user-by-id.query.interface';

export class FindUserByIdQuery implements FindUserByIdQueryInterface {
  constructor(private readonly queryRepository: UserQueryRepositoryInterface) {}

  async execute(id: string): Promise<UserReadModel> {
    const user = await this.queryRepository.findOneById(id);
    if (!user) {
      throw new UserNotFoundError();
    }
    return user;
  }
}
