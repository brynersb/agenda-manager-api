import type {
  TokenVerifierInterface,
  VerificationResult,
  VerifiedClaims,
} from '@/modules/auth/application/interfaces/token-verifier.interface';
import { Role } from '@/modules/auth/domain/enums/role';
import { TOKENS } from '../core/tokens';

const CLAIMS_BY_TOKEN: Record<string, VerifiedClaims> = {
  [TOKENS.editor]: {
    sub: 'e2e-editor',
    name: 'Editor E2E',
    email: 'editor@e2e.test',
    roles: [Role.Editor],
  },
  [TOKENS.viewer]: {
    sub: 'e2e-viewer',
    name: 'Leitor E2E',
    email: 'viewer@e2e.test',
    roles: [Role.Viewer],
  },
  [TOKENS.noRole]: {
    sub: 'e2e-no-role',
    name: 'Sem Papel E2E',
    email: null,
    roles: [],
  },
};

/** Substitui o `OidcTokenService` no e2e: só conhece os tokens de `TOKENS`. */
export class E2eOidcTokenService implements TokenVerifierInterface {
  async verify(token: string): Promise<VerificationResult> {
    const claims = Object.hasOwn(CLAIMS_BY_TOKEN, token)
      ? CLAIMS_BY_TOKEN[token]
      : undefined;
    return claims
      ? { ok: true, claims }
      : { ok: false, reason: 'invalid_signature' };
  }
}
