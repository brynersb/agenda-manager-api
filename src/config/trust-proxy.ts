import { isIP } from 'node:net';

/** O que o Express aceita em `trust proxy` e que este app permite. */
export type TrustProxySetting = false | number | string[];

export type TrustProxyParseResult =
  | { ok: true; value: TrustProxySetting }
  | { ok: false; message: string };

/** Teto de saltos: mais que isso é quase certamente engano (e abre a porta à falsificação de IP). */
export const TRUST_PROXY_MAX_HOPS = 10;

/** Atalhos do Express (pacote `proxy-addr`) para faixas de rede privadas. */
const EXPRESS_KEYWORDS: readonly string[] = [
  'loopback',
  'linklocal',
  'uniquelocal',
];

const INTEGER_FORMAT = /^\d+$/;
const MAX_PREFIX = { 4: 32, 6: 128 } as const;

function invalid(message: string): TrustProxyParseResult {
  return {
    ok: false,
    message: `TRUST_PROXY ${message} Use false (padrão), o número de saltos de proxy (ex.: 1) ou uma lista de IPs/sub-redes separados por vírgula (ex.: 10.0.0.0/8,172.16.0.0/12).`,
  };
}

/** `ip` ou `ip/prefixo`; devolve um motivo de recusa ou `undefined` se a entrada é válida. */
function rejectEntry(entry: string): string | undefined {
  if (entry === '') {
    return 'tem uma entrada vazia na lista.';
  }
  const lowered = entry.toLowerCase();
  if (lowered === 'true') {
    return 'não aceita "true" dentro da lista.';
  }
  if (EXPRESS_KEYWORDS.includes(lowered)) {
    return undefined;
  }

  const [address, prefix, ...rest] = entry.split('/');
  const version = isIP(address ?? '');
  if (rest.length > 0 || (version !== 4 && version !== 6)) {
    return `tem a entrada "${entry}", que não é um IP nem uma sub-rede válida.`;
  }
  if (prefix === undefined) {
    return undefined;
  }
  if (!INTEGER_FORMAT.test(prefix) || Number(prefix) > MAX_PREFIX[version]) {
    return `tem a entrada "${entry}" com prefixo de sub-rede inválido.`;
  }
  if (Number(prefix) === 0) {
    return `tem a entrada "${entry}", que confia em qualquer origem (equivale a "true") e permitiria falsificar o IP.`;
  }
  return undefined;
}

/**
 * Interpreta `TRUST_PROXY`: `false` (padrão), inteiro de saltos (1 a 10) ou
 * lista de IPs/sub-redes separados por vírgula. Recusa `true` puro e
 * sub-redes `/0`, que confiariam em qualquer `X-Forwarded-For` e deixariam o
 * cliente escolher o próprio IP (burlando o limite por IP e a auditoria).
 */
export function parseTrustProxy(raw: unknown): TrustProxyParseResult {
  const text = raw === undefined || raw === null ? '' : String(raw).trim();
  const lowered = text.toLowerCase();

  if (text === '' || lowered === 'false') {
    return { ok: true, value: false };
  }
  if (lowered === 'true') {
    return invalid(
      'não aceita "true": confiaria em qualquer X-Forwarded-For e deixaria o cliente falsificar o IP.',
    );
  }

  if (INTEGER_FORMAT.test(text)) {
    const hops = Number(text);
    if (hops === 0) {
      return { ok: true, value: false };
    }
    if (hops > TRUST_PROXY_MAX_HOPS) {
      return invalid(
        `aceita no máximo ${TRUST_PROXY_MAX_HOPS} saltos (recebeu ${hops}).`,
      );
    }
    return { ok: true, value: hops };
  }

  const entries = text.split(',').map((entry) => entry.trim());
  for (const entry of entries) {
    const reason = rejectEntry(entry);
    if (reason) {
      return invalid(reason);
    }
  }
  return { ok: true, value: entries };
}
