import type { PasswordGeneratorInterface } from '@/modules/user/application/interfaces/password-generator.interface';
import type { UserRepositoryInterface } from '@/modules/user/application/interfaces/repositories/user.repository.interface';
import type {
  UserQueryRepositoryInterface,
  UserReadModel,
} from '@/modules/user/application/interfaces/repositories/user-query.repository.interface';
import { UserDomainEntity } from '@/modules/user/domain/entities/user.domain-entity';
import {
  EmailAlreadyRegisteredError,
  UserNotFoundError,
} from '@/modules/user/domain/errors/user.errors';
import { assertPasswordPolicy } from '@/modules/user/domain/services/password-policy';
import { UserEmail } from '@/modules/user/domain/value-objects/user-email';
import { UserName } from '@/modules/user/domain/value-objects/user-name';
import type { ClockInterface } from '@/shared/application/interfaces/clock.interface';
import type { LoggerServiceInterface } from '@/shared/application/interfaces/logger.service.interface';
import type { PasswordHasherInterface } from '@/shared/application/interfaces/password-hasher.interface';
import type {
  CreateUserInput,
  CreateUserResult,
  CreateUserUseCaseInterface,
} from './create-user.use-case.interface';

/**
 * Cria um usuário. O usuário sempre nasce com `mustChangePassword = true`: a
 * senha, gerada ou informada, é conhecida de quem administra.
 */
export class CreateUserUseCase implements CreateUserUseCaseInterface {
  constructor(
    private readonly repository: UserRepositoryInterface,
    private readonly queryRepository: UserQueryRepositoryInterface,
    private readonly hasher: PasswordHasherInterface,
    private readonly passwordGenerator: PasswordGeneratorInterface,
    private readonly clock: ClockInterface,
    private readonly logger: LoggerServiceInterface,
  ) {
    this.logger.setLogPrefix(CreateUserUseCase.name);
  }

  async execute(input: CreateUserInput): Promise<CreateUserResult> {
    const name = UserName.create(input.name);
    const email = UserEmail.create(input.email);

    const generated = input.password === undefined;
    const password = input.password ?? this.passwordGenerator.generate();
    if (!generated) {
      assertPasswordPolicy(password);
    }

    if (await this.repository.findByEmail(email.value)) {
      this.recordDuplicated(input);
      throw new EmailAlreadyRegisteredError();
    }

    const user = UserDomainEntity.create(
      {
        name,
        email,
        role: input.role,
        passwordHash: await this.hasher.hash(password),
        mustChangePassword: true,
      },
      input.actor,
      this.clock.now(),
    );
    try {
      await this.repository.save(user);
    } catch (error) {
      // Corrida: outro pedido cadastrou o mesmo e-mail entre a checagem e o insert.
      if (error instanceof EmailAlreadyRegisteredError) {
        this.recordDuplicated(input);
      }
      throw error;
    }

    this.logger.info('Usuário criado', {
      'evt.name': 'user.created',
      outcome: 'success',
      user_id: user.id,
      role: user.role,
      password_generated: generated,
      user_sub: input.actor.id,
      tags: ['user', 'admin'],
    });

    return {
      user: await this.load(user.id),
      temporaryPassword: generated ? password : null,
    };
  }

  private async load(id: string): Promise<UserReadModel> {
    const created = await this.queryRepository.findOneById(id);
    if (!created) {
      throw new UserNotFoundError();
    }
    return created;
  }

  private recordDuplicated(input: CreateUserInput): void {
    this.logger.warn('Criação de usuário bloqueada: e-mail já cadastrado', {
      'evt.name': 'user.created',
      outcome: 'blocked',
      reason: 'email_already_registered',
      user_sub: input.actor.id,
      tags: ['user', 'admin'],
    });
  }
}
