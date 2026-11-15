import { Role } from '@/modules/auth/domain/enums/role';
import type { UserRepositoryInterface } from '@/modules/user/application/interfaces/repositories/user.repository.interface';
import { USER_REPOSITORY } from '@/modules/user/application/interfaces/repositories/user.repository.interface';
import { UserDomainEntity } from '@/modules/user/domain/entities/user.domain-entity';
import { UserEmail } from '@/modules/user/domain/value-objects/user-email';
import { UserName } from '@/modules/user/domain/value-objects/user-name';
import type { PasswordHasherInterface } from '@/shared/application/interfaces/password-hasher.interface';
import { PASSWORD_HASHER } from '@/shared/application/interfaces/password-hasher.interface';
import type { AppE2e } from '../runner/app-bootstrap';

/** Resposta de `POST /auth/login` e `POST /auth/refresh`. */
export type AuthSessionBody = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  mustChangePassword: boolean;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    permissions: string[];
  };
};

export const LOGIN_URL = '/api/v1/auth/login';
export const REFRESH_URL = '/api/v1/auth/refresh';
export const LOGOUT_URL = '/api/v1/auth/logout';
export const CHANGE_PASSWORD_URL = '/api/v1/auth/change-password';
export const USER_INFO_URL = '/api/v1/auth/user-info';

/** Senha padrão dos usuários criados pelos testes (só existe no e2e). */
export const E2E_PASSWORD = 'senha-de-teste-e2e-1';

export type CreatedUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  password: string;
};

export type CreateUserOptions = Partial<{
  name: string;
  email: string;
  role: Role;
  password: string;
  mustChangePassword: boolean;
  deactivated: boolean;
}>;

let sequence = 0;

/**
 * Cria um usuário direto pela porta de repositório (com hash argon2id real),
 * sem passar pela API: massa de dados para os testes. Por padrão não exige
 * troca de senha, para o login devolver `mustChangePassword: false`.
 */
export async function createUser(
  e2e: AppE2e,
  options: CreateUserOptions = {},
): Promise<CreatedUser> {
  sequence += 1;
  const repository = e2e.app.get<UserRepositoryInterface>(USER_REPOSITORY);
  const hasher = e2e.app.get<PasswordHasherInterface>(PASSWORD_HASHER);
  const password = options.password ?? E2E_PASSWORD;
  const role = options.role ?? Role.Editor;

  const user = UserDomainEntity.create(
    {
      name: UserName.create(options.name ?? `Usuário Teste ${sequence}`),
      email: UserEmail.create(options.email ?? `user${sequence}@e2e.test`),
      role,
      passwordHash: await hasher.hash(password),
      mustChangePassword: options.mustChangePassword ?? false,
    },
    { id: 'e2e-setup', name: 'Setup E2E' },
    e2e.clock.now(),
  );
  await repository.save(user);
  if (options.deactivated) {
    await e2e.dataSource.query(
      `UPDATE users SET status = 'DEACTIVATED' WHERE id = $1`,
      [user.id],
    );
  }
  return {
    id: user.id,
    name: user.name.value,
    email: user.email.value,
    role,
    password,
  };
}

/** Login real pela API. */
export function login(
  e2e: AppE2e,
  credentials: { email: string; password: string },
) {
  return e2e.client.post<AuthSessionBody & { code?: string; message?: string }>(
    LOGIN_URL,
    { body: { email: credentials.email, password: credentials.password } },
  );
}

/** Login real que exige sucesso e devolve a sessão (tokens e usuário). */
export async function loginAs(
  e2e: AppE2e,
  user: Pick<CreatedUser, 'email' | 'password'>,
): Promise<AuthSessionBody> {
  const res = await login(e2e, user);
  if (res.status !== 200) {
    throw new Error(`login falhou: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

export function refresh(e2e: AppE2e, refreshToken: string) {
  return e2e.client.post<AuthSessionBody & { code?: string }>(REFRESH_URL, {
    body: { refreshToken },
  });
}
