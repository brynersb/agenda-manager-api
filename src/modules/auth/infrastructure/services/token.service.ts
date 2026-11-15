import { createHash, randomBytes } from 'node:crypto';

import * as jwt from 'jsonwebtoken';

import type {
  AccessTokenSubject,
  GeneratedRefreshToken,
  IssuedAccessToken,
  TokenFailureReason,
  TokenServiceInterface,
  VerificationResult,
} from '@/modules/auth/application/interfaces/token.service.interface';
import { isRole } from '@/modules/auth/domain/enums/role';

export type TokenServiceConfig = {
  /** Segredo HMAC (mínimo de 32 caracteres, validado na configuração). */
  secret: string;
  /** `iss` fixo do access token. */
  issuer: string;
  /** `aud` fixo do access token. */
  audience: string;
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
};

/** Único algoritmo aceito: fixá-lo na verificação bloqueia `alg: none` e confusão de algoritmo. */
const ALGORITHM = 'HS256';

/** Bytes aleatórios do refresh token: 256 bits. */
const REFRESH_TOKEN_BYTES = 32;

function nonBlankText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
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
    if (
      error.message === 'jwt malformed' ||
      error.message === 'invalid token'
    ) {
      return 'invalid_format';
    }
  }
  return 'invalid_signature';
}

/**
 * Access token JWT HS256 (`sub`, `email`, `name`, `role`, `iss`, `aud`, `iat`,
 * `exp`) e refresh token opaco de 256 bits (ADR-016). A verificação do JWT é
 * local e não consulta o banco.
 */
export class TokenService implements TokenServiceInterface {
  constructor(private readonly config: TokenServiceConfig) {}

  get refreshTtlSeconds(): number {
    return this.config.refreshTtlSeconds;
  }

  issueAccessToken(subject: AccessTokenSubject): IssuedAccessToken {
    const token = jwt.sign(
      { email: subject.email, name: subject.name, role: subject.role },
      this.config.secret,
      {
        algorithm: ALGORITHM,
        subject: subject.id,
        issuer: this.config.issuer,
        audience: this.config.audience,
        expiresIn: this.config.accessTtlSeconds,
      },
    );
    return { token, expiresIn: this.config.accessTtlSeconds };
  }

  verifyAccessToken(token: string): VerificationResult {
    let payload: jwt.JwtPayload;
    try {
      const verified = jwt.verify(token, this.config.secret, {
        algorithms: [ALGORITHM],
        issuer: this.config.issuer,
        audience: this.config.audience,
      });
      if (typeof verified === 'string') {
        return { ok: false, reason: 'invalid_format' };
      }
      payload = verified;
    } catch (error) {
      return { ok: false, reason: verificationErrorReason(error) };
    }

    const id = nonBlankText(payload.sub);
    const email = nonBlankText(payload.email);
    const name = nonBlankText(payload.name);
    const { role } = payload;
    if (!id || !email || !name || !isRole(role)) {
      return { ok: false, reason: 'invalid_claims' };
    }
    return { ok: true, claims: { id, email, name, role } };
  }

  generateRefreshToken(): GeneratedRefreshToken {
    const token = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
    return { token, hash: this.hashRefreshToken(token) };
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
