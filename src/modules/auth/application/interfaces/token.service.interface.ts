import type { Role } from '@/modules/auth/domain/enums/role';

/**
 * Dados que entram no access token (as claims `sub`, `email`, `name`, `role` e,
 * só quando verdadeira, `mcp`).
 */
export type AccessTokenSubject = {
  id: string;
  email: string;
  name: string;
  role: Role;
  /**
   * Senha provisória pendente: vira a claim booleana `mcp` (must change
   * password), omitida quando falso. O `AuthGuard` restringe o token às rotas
   * `@AllowPendingPasswordChange()`.
   */
  mustChangePassword?: boolean;
};

/** Claims validadas de um access token: `mustChangePassword` é sempre booleano. */
export type AccessTokenClaims = AccessTokenSubject & {
  mustChangePassword: boolean;
};

export type IssuedAccessToken = {
  token: string;
  /** Validade em segundos, a partir da emissão. */
  expiresIn: number;
};

/** Por que um access token foi recusado. Nunca carrega o token. */
export type TokenFailureReason =
  | 'invalid_format'
  | 'invalid_signature'
  | 'expired'
  | 'invalid_issuer'
  | 'invalid_audience'
  | 'invalid_claims';

export type VerificationResult =
  | { ok: true; claims: AccessTokenClaims }
  | { ok: false; reason: TokenFailureReason };

/** Refresh token recém-gerado: o valor em claro vai ao cliente; só o hash é gravado. */
export type GeneratedRefreshToken = {
  /** 256 bits aleatórios em base64url. */
  token: string;
  /** SHA-256 (hex) do token. */
  hash: string;
};

/**
 * Porta de emissão e validação de tokens (ADR-016): access token JWT HS256 e
 * refresh token opaco. Nunca lança por token inválido.
 */
export interface TokenServiceInterface {
  /** Validade do refresh token em segundos (`JWT_REFRESH_TTL`). */
  readonly refreshTtlSeconds: number;

  issueAccessToken(subject: AccessTokenSubject): IssuedAccessToken;

  /** Confere assinatura (HS256), `iss`, `aud`, expiração e a forma das claims. */
  verifyAccessToken(token: string): VerificationResult;

  generateRefreshToken(): GeneratedRefreshToken;

  /** SHA-256 (hex) de um refresh token apresentado pelo cliente. */
  hashRefreshToken(token: string): string;
}

export const TOKEN_SERVICE = Symbol('TokenServiceInterface');
