import { createHash } from 'node:crypto';

import * as jwt from 'jsonwebtoken';

import { Role } from '@/modules/auth/domain/enums/role';
import {
  TokenService,
  type TokenServiceConfig,
} from '@/modules/auth/infrastructure/services/token.service';

const CONFIG: TokenServiceConfig = {
  secret: 'segredo-de-teste-com-mais-de-32-caracteres',
  issuer: 'pauta-mkt-api',
  audience: 'pauta-mkt',
  accessTtlSeconds: 900,
  refreshTtlSeconds: 604_800,
};

const SUBJECT = {
  id: '0192f6a0-7c1e-7a3b-9d52-4f1e8b6c2a10',
  email: 'maria@pauta.local',
  name: 'Maria Souza',
  role: Role.Editor,
};

/** Assina um token arbitrário com o segredo de teste (para forjar casos inválidos). */
function sign(
  payload: Record<string, unknown>,
  options: jwt.SignOptions = {},
  secret = CONFIG.secret,
): string {
  return jwt.sign(payload, secret, {
    algorithm: 'HS256',
    issuer: CONFIG.issuer,
    audience: CONFIG.audience,
    expiresIn: 900,
    // `sub: null` no payload é como se forja um token sem `sub`.
    ...(payload.sub === undefined ? { subject: SUBJECT.id } : {}),
    ...options,
  });
}

describe('TokenService', () => {
  const service = new TokenService(CONFIG);

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('access token', () => {
    it('emite JWT HS256 com sub, email, name, role, iss, aud, iat e exp', () => {
      const { token, expiresIn } = service.issueAccessToken(SUBJECT);

      const decoded = jwt.decode(token, { complete: true });
      expect(decoded?.header).toMatchObject({ alg: 'HS256', typ: 'JWT' });
      expect(decoded?.payload).toMatchObject({
        sub: SUBJECT.id,
        email: SUBJECT.email,
        name: SUBJECT.name,
        role: SUBJECT.role,
        iss: 'pauta-mkt-api',
        aud: 'pauta-mkt',
      });
      const { iat, exp } = jwt.decode(token) as { iat: number; exp: number };
      expect(exp - iat).toBe(900);
      expect(expiresIn).toBe(900);
    });

    it('o token só carrega as claims combinadas (nada de permissões)', () => {
      const { token } = service.issueAccessToken(SUBJECT);

      expect(Object.keys(jwt.decode(token) as object).sort()).toEqual(
        ['aud', 'email', 'exp', 'iat', 'iss', 'name', 'role', 'sub'].sort(),
      );
    });

    it('verifica o que emitiu e devolve as claims', () => {
      const { token } = service.issueAccessToken(SUBJECT);

      expect(service.verifyAccessToken(token)).toEqual({
        ok: true,
        claims: { ...SUBJECT, mustChangePassword: false },
      });
    });

    it('omite a claim mcp quando mustChangePassword é falso ou ausente', () => {
      for (const subject of [
        SUBJECT,
        { ...SUBJECT, mustChangePassword: false },
      ]) {
        const { token } = service.issueAccessToken(subject);

        expect(jwt.decode(token)).not.toHaveProperty('mcp');
        expect(service.verifyAccessToken(token)).toMatchObject({
          ok: true,
          claims: { mustChangePassword: false },
        });
      }
    });

    it('emite mcp: true com senha provisória pendente e a verificação devolve mustChangePassword', () => {
      const { token } = service.issueAccessToken({
        ...SUBJECT,
        mustChangePassword: true,
      });

      expect(jwt.decode(token)).toMatchObject({ mcp: true });
      expect(service.verifyAccessToken(token)).toEqual({
        ok: true,
        claims: { ...SUBJECT, mustChangePassword: true },
      });
    });

    it('só trata mcp estritamente verdadeiro como pendência', () => {
      const base = {
        email: SUBJECT.email,
        name: SUBJECT.name,
        role: SUBJECT.role,
      };

      for (const mcp of ['true', 1, false, null]) {
        expect(service.verifyAccessToken(sign({ ...base, mcp }))).toMatchObject(
          { ok: true, claims: { mustChangePassword: false } },
        );
      }
    });

    it('expira depois do TTL', () => {
      vi.useFakeTimers({ now: new Date('2026-11-14T12:00:00Z') });
      const { token } = service.issueAccessToken(SUBJECT);

      vi.setSystemTime(new Date('2026-11-14T12:14:59Z'));
      expect(service.verifyAccessToken(token).ok).toBe(true);

      vi.setSystemTime(new Date('2026-11-14T12:15:01Z'));
      expect(service.verifyAccessToken(token)).toEqual({
        ok: false,
        reason: 'expired',
      });
    });

    it('recusa token adulterado (payload trocado mantendo a assinatura)', () => {
      const { token } = service.issueAccessToken(SUBJECT);
      const [header, , signature] = token.split('.');
      const forgedPayload = Buffer.from(
        JSON.stringify({ ...SUBJECT, sub: SUBJECT.id, role: Role.Admin }),
      ).toString('base64url');

      expect(
        service.verifyAccessToken(`${header}.${forgedPayload}.${signature}`),
      ).toEqual({ ok: false, reason: 'invalid_signature' });
    });

    it('recusa assinatura com outro segredo', () => {
      const forged = sign(
        { ...SUBJECT },
        {},
        'outro-segredo-com-mais-de-32-caracteres!',
      );

      expect(service.verifyAccessToken(forged)).toEqual({
        ok: false,
        reason: 'invalid_signature',
      });
    });

    it('recusa alg none', () => {
      const header = Buffer.from(
        JSON.stringify({ alg: 'none', typ: 'JWT' }),
      ).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({
          ...SUBJECT,
          sub: SUBJECT.id,
          iss: CONFIG.issuer,
          aud: CONFIG.audience,
          exp: Math.floor(Date.now() / 1000) + 900,
        }),
      ).toString('base64url');

      expect(service.verifyAccessToken(`${header}.${payload}.`).ok).toBe(false);
    });

    it('recusa algoritmo diferente de HS256 (HS512 com o mesmo segredo)', () => {
      const forged = sign({ ...SUBJECT }, { algorithm: 'HS512' });

      expect(service.verifyAccessToken(forged)).toEqual({
        ok: false,
        reason: 'invalid_signature',
      });
    });

    it('recusa issuer e audience errados', () => {
      expect(
        service.verifyAccessToken(sign({ ...SUBJECT }, { issuer: 'outro' })),
      ).toEqual({ ok: false, reason: 'invalid_issuer' });
      expect(
        service.verifyAccessToken(sign({ ...SUBJECT }, { audience: 'outra' })),
      ).toEqual({ ok: false, reason: 'invalid_audience' });
    });

    it.each(['', 'lixo', 'a.b', 'a.b.c', 'Bearer x.y.z'])(
      'recusa token malformado "%s"',
      (token) => {
        expect(service.verifyAccessToken(token).ok).toBe(false);
      },
    );

    it('recusa claims incompletas ou papel desconhecido (invalid_claims)', () => {
      const base = {
        email: SUBJECT.email,
        name: SUBJECT.name,
        role: SUBJECT.role,
      };

      expect(
        service.verifyAccessToken(sign({ ...base, role: 'ghost' })),
      ).toEqual({ ok: false, reason: 'invalid_claims' });
      expect(
        service.verifyAccessToken(sign({ ...base, email: undefined })),
      ).toEqual({ ok: false, reason: 'invalid_claims' });
      expect(service.verifyAccessToken(sign({ ...base, name: ' ' }))).toEqual({
        ok: false,
        reason: 'invalid_claims',
      });
      expect(service.verifyAccessToken(sign({ ...base, sub: '  ' }))).toEqual({
        ok: false,
        reason: 'invalid_claims',
      });
    });
  });

  describe('refresh token', () => {
    it('gera 256 bits aleatórios em base64url (43 caracteres)', () => {
      const { token } = service.generateRefreshToken();

      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    });

    it('o hash é o SHA-256 em hex do token', () => {
      const { token, hash } = service.generateRefreshToken();

      expect(hash).toBe(createHash('sha256').update(token).digest('hex'));
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
      expect(service.hashRefreshToken(token)).toBe(hash);
    });

    it('cada chamada gera um token diferente', () => {
      const tokens = new Set(
        Array.from({ length: 50 }, () => service.generateRefreshToken().token),
      );

      expect(tokens.size).toBe(50);
    });

    it('expõe o TTL configurado', () => {
      expect(service.refreshTtlSeconds).toBe(604_800);
    });
  });
});
