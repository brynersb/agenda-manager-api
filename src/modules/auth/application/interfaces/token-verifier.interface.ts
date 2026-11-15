import type { Role } from '@/modules/auth/domain/enums/role';

/** Dados do access token já validado (assinatura, issuer, audience e prazo). */
export type VerifiedClaims = {
  sub: string;
  name: string | null;
  email: string | null;
  /** Só papéis `content-brief-*` conhecidos; os demais da claim são descartados. */
  roles: Role[];
};

/** Por que um token foi recusado. Nunca carrega o token. */
export type TokenFailureReason =
  | 'token_missing'
  | 'invalid_format'
  | 'invalid_signature'
  | 'expired'
  | 'invalid_issuer'
  | 'invalid_audience'
  | 'jwks_unavailable';

export type VerificationResult =
  | { ok: true; claims: VerifiedClaims }
  | { ok: false; reason: TokenFailureReason };

/** Porta que valida o access token. Nunca lança por token inválido. */
export interface TokenVerifierInterface {
  verify(token: string): Promise<VerificationResult>;
}

export const OIDC_TOKEN_SERVICE = Symbol('OidcTokenService');
