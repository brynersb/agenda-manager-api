import { Role } from '@/modules/auth/domain/enums/role';
import type { UserRepositoryInterface } from '@/modules/user/application/interfaces/repositories/user.repository.interface';
import { UserDomainEntity } from '@/modules/user/domain/entities/user.domain-entity';
import { EmailAlreadyRegisteredError } from '@/modules/user/domain/errors/user.errors';
import { assertPasswordPolicy } from '@/modules/user/domain/services/password-policy';
import { UserEmail } from '@/modules/user/domain/value-objects/user-email';
import { UserName } from '@/modules/user/domain/value-objects/user-name';
import type { ClockInterface } from '@/shared/application/interfaces/clock.interface';
import type { LoggerServiceInterface } from '@/shared/application/interfaces/logger.service.interface';
import type { PasswordHasherInterface } from '@/shared/application/interfaces/password-hasher.interface';
import type { Actor } from '@/shared/domain/actor';
import type {
  BootstrapAdminInput,
  BootstrapAdminOutcome,
  BootstrapAdminUseCaseInterface,
} from './bootstrap-admin.use-case.interface';

/** Autor da auditoria do administrador inicial. */
export const BOOTSTRAP_ACTOR: Actor = {
  id: 'bootstrap',
  name: 'Bootstrap do administrador',
};

const BOOTSTRAP_ADMIN_NAME = 'Administrador';

/**
 * Cria o primeiro administrador quando **não existe nenhum usuário** e o
 * ambiente traz e-mail e senha. Idempotente: com usuários, não faz nada. O
 * admin nasce com `mustChangePassword = true`. Registra o e-mail, nunca a senha.
 */
export class BootstrapAdminUseCase implements BootstrapAdminUseCaseInterface {
  constructor(
    private readonly repository: UserRepositoryInterface,
    private readonly hasher: PasswordHasherInterface,
    private readonly clock: ClockInterface,
    private readonly logger: LoggerServiceInterface,
  ) {
    this.logger.setLogPrefix(BootstrapAdminUseCase.name);
  }

  async execute(input: BootstrapAdminInput): Promise<BootstrapAdminOutcome> {
    if ((await this.repository.count()) > 0) {
      return 'users_exist';
    }

    if (!input.email || !input.password) {
      this.logger.warn(
        'Nenhum usuário cadastrado e BOOTSTRAP_ADMIN_EMAIL/BOOTSTRAP_ADMIN_PASSWORD não estão definidos: ninguém conseguirá entrar. Defina as duas variáveis (ou rode o seed:dev em desenvolvimento) e reinicie a API.',
        {
          'evt.name': 'user.bootstrap_admin',
          outcome: 'skipped',
          reason: 'not_configured',
          tags: ['user', 'bootstrap'],
        },
      );
      return 'not_configured';
    }

    const email = UserEmail.create(input.email);
    assertPasswordPolicy(input.password);

    const admin = UserDomainEntity.create(
      {
        name: UserName.create(BOOTSTRAP_ADMIN_NAME),
        email,
        role: Role.Admin,
        passwordHash: await this.hasher.hash(input.password),
        mustChangePassword: true,
      },
      BOOTSTRAP_ACTOR,
      this.clock.now(),
    );
    try {
      await this.repository.save(admin);
    } catch (error) {
      // Duas instâncias subindo juntas: a outra criou o admin primeiro.
      if (error instanceof EmailAlreadyRegisteredError) {
        return 'users_exist';
      }
      throw error;
    }

    this.logger.info('Administrador inicial criado', {
      'evt.name': 'user.bootstrap_admin',
      outcome: 'success',
      user_id: admin.id,
      email: email.value,
      tags: ['user', 'bootstrap'],
    });
    return 'created';
  }
}
