import * as jwt from 'jsonwebtoken';

import { DEV_JWT_SECRET } from '@/config/env.validation';
import { Role } from '@/modules/auth/domain/enums/role';

/**
 * Access tokens de teste, um por perfil, emitidos pelo `TokenService` real da
 * aplicação (HS256, mesmo segredo e mesmas claims do login). O `bootstrapApp`
 * os preenche logo depois de subir o app; use-os em `client.get(url, { token })`.
 * São tokens "avulsos": o `sub` não existe na tabela `users` (o guard não
 * consulta o banco), então valem mesmo depois de `cleanDatabase`.
 * Para fluxos que dependem de usuário real (login, refresh, administração),
 * use `createUser` e `loginAs` (`e2e/src/core/users.ts`).
 */
export const TOKENS = {
  admin: '',
  editor: '',
  viewer: '',
  /** Assinado com o segredo certo, mas com um papel que a API não conhece. */
  unknownRole: '',
};

/** Identidade embutida em cada token avulso (auditoria: `created_by` = `id`). */
export const TOKEN_USERS = {
  admin: { id: 'e2e-admin', name: 'Admin E2E', email: 'admin@e2e.test' },
  editor: { id: 'e2e-editor', name: 'Editor E2E', email: 'editor@e2e.test' },
  viewer: { id: 'e2e-viewer', name: 'Leitor E2E', email: 'viewer@e2e.test' },
} as const;

export type ForgeOptions = {
  sub?: string;
  role?: string;
  /** Segredo de assinatura (padrão: o de desenvolvimento, o mesmo do app no e2e). */
  secret?: string;
  /** Validade em segundos a partir de agora; negativo gera um token já expirado. */
  expiresIn?: number;
  issuer?: string;
  audience?: string;
};

/**
 * Fabrica um access token arbitrário assinado com `jsonwebtoken` (não passa
 * pelo `TokenService`): serve para forjar casos inválidos (expirado, papel
 * desconhecido, outro segredo, iss/aud errados).
 */
export function forgeAccessToken(options: ForgeOptions = {}): string {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      sub: options.sub ?? 'e2e-forged',
      email: 'forged@e2e.test',
      name: 'Forjado E2E',
      role: options.role ?? Role.Editor,
      iss: options.issuer ?? 'pauta-mkt-api',
      aud: options.audience ?? 'pauta-mkt',
      iat: now,
      exp: now + (options.expiresIn ?? 900),
    },
    options.secret ?? DEV_JWT_SECRET,
    { algorithm: 'HS256' },
  );
}
