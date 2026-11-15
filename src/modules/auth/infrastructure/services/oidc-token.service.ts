import * as jwt from 'jsonwebtoken';
import { SigningKeyNotFoundError } from 'jwks-rsa';

import type {
  TokenFailureReason,
  TokenVerifierInterface,
  VerificationResult,
} from '@/modules/auth/application/interfaces/token-verifier.interface';
import { isRole, type Role } from '@/modules/auth/domain/enums/role';

export type OidcTokenServiceConfig = {
  /** `iss` esperado no token. Vazio = autenticação OIDC não configurada. */
  issuer: string;
  /** O `aud` do token precisa conter pelo menos um destes valores. */
  audiences: string[];
  /** Caminho com ponto da claim de papéis (ex.: `realm_access.roles`). */
  rolesClaim: string;
};

/** Parte do `JwksClient` de que o serviço depende (facilita o dublê nos testes). */
export type SigningKeyProvider = {
  getSigningKey(kid: string): Promise<{ getPublicKey(): string }>;
};

/** Tolerância de relógio entre a API e o Keycloak, em segundos. */
const CLOCK_TOLERANCE_SECONDS = 30;

function nonBlankText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/** Resolve `a.b.c` em `claims`; caminho ausente ou não-lista vira lista vazia. */
function readRoles(claims: Record<string, unknown>, path: string): Role[] {
  let current: unknown = claims;
  for (const part of path.split('.')) {
    if (
      typeof current !== 'object' ||
      current === null ||
      !Object.hasOwn(current, part)
    ) {
      return [];
    }
    current = (current as Record<string, unknown>)[part];
  }
  return Array.isArray(current) ? current.filter(isRole) : [];
}

/** Traduz o erro do `jsonwebtoken` para o motivo tipado (nunca expõe o token). */
function verificationErrorReason(error: unknown): TokenFailureReason {
  if (error instanceof jwt.TokenExpiredError) {
    return 'expired';
  }
  if (error instanceof jwt.JsonWebTokenError) {
    if (error.message.startsWith('jwt issuer invalid')) {
      return 'invalid_issuer';
    }
    if (error.message.startsWith('jwt audience invalid')) {
      return 'invalid_audience';
    }
    if (error.message === 'jwt malformed') {
      return 'invalid_format';
    }
  }
  return 'invalid_signature';
}

/**
 * Valida o access token do Keycloak: RS256, `iss`, `aud` e `exp` com a chave
 * pública do JWKS. Não há Cognito, API key nem Basic (ADR-003).
 */
export class OidcTokenService implements TokenVerifierInterface {
  constructor(
    private readonly config: OidcTokenServiceConfig,
    private readonly keys: SigningKeyProvider,
  ) {}

  async verify(token: string): Promise<VerificationResult> {
    if (!this.config.issuer || this.config.audiences.length === 0) {
      return { ok: false, reason: 'jwks_unavailable' };
    }

    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded === 'string') {
      return { ok: false, reason: 'invalid_format' };
    }
    const { alg, kid } = decoded.header;
    if (alg !== 'RS256') {
      return { ok: false, reason: 'invalid_signature' };
    }
    if (!kid) {
      return { ok: false, reason: 'invalid_format' };
    }

    let publicKey: string;
    try {
      publicKey = (await this.keys.getSigningKey(kid)).getPublicKey();
    } catch (error) {
      return {
        ok: false,
        reason:
          error instanceof SigningKeyNotFoundError
            ? 'invalid_signature'
            : 'jwks_unavailable',
      };
    }

    let claims: jwt.JwtPayload;
    try {
      const verified = jwt.verify(token, publicKey, {
        algorithms: ['RS256'],
        issuer: this.config.issuer,
        audience: this.config.audiences as [string, ...string[]],
        clockTolerance: CLOCK_TOLERANCE_SECONDS,
      });
      if (typeof verified === 'string') {
        return { ok: false, reason: 'invalid_format' };
      }
      claims = verified;
    } catch (error) {
      return { ok: false, reason: verificationErrorReason(error) };
    }

    const sub = nonBlankText(claims.sub);
    if (!sub) {
      return { ok: false, reason: 'invalid_format' };
    }

    return {
      ok: true,
      claims: {
        sub,
        name:
          nonBlankText(claims.name) ?? nonBlankText(claims.preferred_username),
        email: nonBlankText(claims.email),
        roles: readRoles(claims, this.config.rolesClaim),
      },
    };
  }
}
