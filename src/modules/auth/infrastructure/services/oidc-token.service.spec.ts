import { generateKeyPairSync, type KeyObject } from 'node:crypto';

import * as jwt from 'jsonwebtoken';
import { JwksError, SigningKeyNotFoundError } from 'jwks-rsa';

import { Role } from '@/modules/auth/domain/enums/role';
import {
  OidcTokenService,
  type SigningKeyProvider,
} from '@/modules/auth/infrastructure/services/oidc-token.service';

const ISSUER = 'http://keycloak.test/realms/bora';
const AUDIENCE = 'pauta-mkt-api';
const KID = 'key-1';

function newKeyPair() {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  return { privateKey, publicKey };
}

const pair = newKeyPair();
const otherPair = newKeyPair();

function pem(key: KeyObject): string {
  return key.export({ type: 'spki', format: 'pem' }).toString();
}

type Options = {
  claims?: Record<string, unknown>;
  key?: KeyObject;
  /** `null` assina sem `kid` no cabeçalho. */
  kid?: string | null;
  expiresIn?: number | string;
  issuer?: string;
  audience?: string | string[];
};

function sign({
  claims = {},
  key = pair.privateKey,
  kid = KID,
  expiresIn = 300,
  issuer = ISSUER,
  audience = AUDIENCE,
}: Options = {}): string {
  return jwt.sign(
    {
      sub: 'user-1',
      name: 'Dev Editor',
      email: 'dev.editor@bora.local',
      realm_access: { roles: ['content-brief-editor', 'offline_access'] },
      ...claims,
    },
    key,
    {
      algorithm: 'RS256',
      ...(kid === null ? {} : { keyid: kid }),
      expiresIn: expiresIn as number,
      issuer,
      audience,
    },
  );
}

describe('OidcTokenService', () => {
  const getSigningKey = vi.fn();
  const keys: SigningKeyProvider = { getSigningKey };

  function create(
    config: Partial<ConstructorParameters<typeof OidcTokenService>[0]> = {},
  ) {
    return new OidcTokenService(
      {
        issuer: ISSUER,
        audiences: [AUDIENCE],
        rolesClaim: 'realm_access.roles',
        ...config,
      },
      keys,
    );
  }

  beforeEach(() => {
    getSigningKey.mockReset();
    getSigningKey.mockResolvedValue({
      getPublicKey: () => pem(pair.publicKey),
    });
  });

  it('aceita token válido e devolve sub, nome, e-mail e papéis conhecidos', async () => {
    const result = await create().verify(sign());

    expect(result).toEqual({
      ok: true,
      claims: {
        sub: 'user-1',
        name: 'Dev Editor',
        email: 'dev.editor@bora.local',
        roles: [Role.Editor],
      },
    });
    expect(getSigningKey).toHaveBeenCalledWith(KID);
  });

  it('lê papéis de claim aninhada configurável', async () => {
    const token = sign({
      claims: {
        realm_access: undefined,
        resource_access: {
          'pauta-mkt-api': { roles: ['content-brief-viewer'] },
        },
      },
    });

    const result = await create({
      rolesClaim: 'resource_access.pauta-mkt-api.roles',
    }).verify(token);

    expect(result).toMatchObject({
      ok: true,
      claims: { roles: [Role.Viewer] },
    });
  });

  it('claim de papéis ausente ou não-lista vira lista vazia', async () => {
    const withoutClaim = sign({ claims: { realm_access: undefined } });
    const notListed = sign({
      claims: { realm_access: { roles: 'content-brief-editor' } },
    });
    const brokenPath = sign({ claims: { realm_access: 'text' } });

    for (const token of [withoutClaim, notListed, brokenPath]) {
      expect(await create().verify(token)).toMatchObject({
        ok: true,
        claims: { roles: [] },
      });
    }
  });

  it('descarta papéis desconhecidos e não confunde com propriedades herdadas', async () => {
    const token = sign({
      claims: {
        realm_access: {
          roles: ['admin', 'content-brief-admin', 'content-brief-viewer'],
        },
      },
    });

    expect(await create().verify(token)).toMatchObject({
      claims: { roles: [Role.Viewer] },
    });
    expect(
      await create({ rolesClaim: 'constructor.name' }).verify(sign()),
    ).toMatchObject({ ok: true, claims: { roles: [] } });
  });

  it('nome cai para preferred_username e depois para null; e-mail ausente é null', async () => {
    const withUsername = sign({
      claims: {
        name: undefined,
        preferred_username: 'dev.editor',
        email: undefined,
      },
    });
    const withoutName = sign({
      claims: {
        name: undefined,
        preferred_username: undefined,
        email: undefined,
      },
    });

    expect(await create().verify(withUsername)).toMatchObject({
      claims: { name: 'dev.editor', email: null },
    });
    expect(await create().verify(withoutName)).toMatchObject({
      claims: { name: null, email: null },
    });
  });

  it('aceita audience em lista quando algum valor da configuração está nela', async () => {
    const token = sign({ audience: ['account', 'pauta-mkt-api'] });

    expect(
      await create({ audiences: ['other', 'pauta-mkt-api'] }).verify(token),
    ).toMatchObject({ ok: true });
  });

  it('recusa token expirado', async () => {
    const result = await create().verify(sign({ expiresIn: -120 }));

    expect(result).toEqual({ ok: false, reason: 'expired' });
  });

  it('tolera 30 s de diferença de relógio', async () => {
    const result = await create().verify(sign({ expiresIn: -10 }));

    expect(result).toMatchObject({ ok: true });
  });

  it('recusa issuer errado', async () => {
    const result = await create().verify(
      sign({ issuer: 'http://outro.test/realms/x' }),
    );

    expect(result).toEqual({ ok: false, reason: 'invalid_issuer' });
  });

  it('recusa audience errada', async () => {
    const result = await create().verify(sign({ audience: 'other-api' }));

    expect(result).toEqual({ ok: false, reason: 'invalid_audience' });
  });

  it('recusa HS256 sem consultar o JWKS', async () => {
    const token = jwt.sign({ sub: 'user-1' }, 'segredo-hmac', {
      algorithm: 'HS256',
      keyid: KID,
      issuer: ISSUER,
      audience: AUDIENCE,
      expiresIn: 300,
    });

    const result = await create().verify(token);

    expect(result).toEqual({ ok: false, reason: 'invalid_signature' });
    expect(getSigningKey).not.toHaveBeenCalled();
  });

  it('recusa alg none', async () => {
    const header = Buffer.from('{"alg":"none","kid":"key-1"}').toString(
      'base64url',
    );
    const body = Buffer.from(
      JSON.stringify({ sub: 'user-1', iss: ISSUER, aud: AUDIENCE }),
    ).toString('base64url');

    const result = await create().verify(`${header}.${body}.`);

    expect(result).toEqual({ ok: false, reason: 'invalid_signature' });
  });

  it('recusa assinatura de outra chave', async () => {
    const result = await create().verify(sign({ key: otherPair.privateKey }));

    expect(result).toEqual({ ok: false, reason: 'invalid_signature' });
  });

  it('recusa texto que não é JWT', async () => {
    expect(await create().verify('isto-nao-e-jwt')).toEqual({
      ok: false,
      reason: 'invalid_format',
    });
  });

  it('recusa token sem kid', async () => {
    expect(await create().verify(sign({ kid: null }))).toEqual({
      ok: false,
      reason: 'invalid_format',
    });
  });

  it('recusa token sem sub', async () => {
    const token = sign({ claims: { sub: undefined } });

    expect(await create().verify(token)).toEqual({
      ok: false,
      reason: 'invalid_format',
    });
  });

  it('kid desconhecido no JWKS é assinatura inválida', async () => {
    getSigningKey.mockRejectedValue(new SigningKeyNotFoundError('sem chave'));

    expect(await create().verify(sign())).toEqual({
      ok: false,
      reason: 'invalid_signature',
    });
  });

  it('falha ao buscar o JWKS é jwks_unavailable', async () => {
    getSigningKey.mockRejectedValue(new JwksError('connect ECONNREFUSED'));

    expect(await create().verify(sign())).toEqual({
      ok: false,
      reason: 'jwks_unavailable',
    });
  });

  it('sem issuer ou audience configurados nada passa', async () => {
    expect(await create({ issuer: '' }).verify(sign())).toEqual({
      ok: false,
      reason: 'jwks_unavailable',
    });
    expect(await create({ audiences: [] }).verify(sign())).toEqual({
      ok: false,
      reason: 'jwks_unavailable',
    });
  });
});
