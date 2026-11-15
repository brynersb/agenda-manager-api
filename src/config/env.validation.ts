import 'reflect-metadata';

import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  Matches,
  Max,
  Min,
  ValidateIf,
  validateSync,
} from 'class-validator';

import { DATABASE_LOCAL_DEFAULTS } from '@/database/database-defaults';
import { KNOWN_ROLES, Role } from '@/modules/auth/domain/enums/role';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

/** Ambiente lógico da POC (ADR-003/ADR-010); `demo` é a stack completa da T14. */
export enum Stage {
  Local = 'local',
  E2e = 'e2e',
  Demo = 'demo',
}

export enum LogLevel {
  Error = 'error',
  Warn = 'warn',
  Info = 'info',
  Debug = 'debug',
}

const DEFAULT_CORS_ORIGINS = 'http://localhost:5173';
const STAGES_WITH_DEFAULT_CORS: readonly Stage[] = [Stage.Local, Stage.E2e];

/** Postgres do `docker/compose.yaml` (porta 5433 do host); só vale em `local`. */
const DATABASE_DEFAULTS_LOCAL = {
  DATABASE_HOST: DATABASE_LOCAL_DEFAULTS.host,
  DATABASE_PORT: DATABASE_LOCAL_DEFAULTS.port,
  DATABASE_USER: DATABASE_LOCAL_DEFAULTS.user,
  DATABASE_PASS: DATABASE_LOCAL_DEFAULTS.pass,
  DATABASE_NAME: DATABASE_LOCAL_DEFAULTS.name,
  DATABASE_SSL: false,
} as const;

const VALID_TIME_ZONES: readonly string[] = [
  'UTC',
  ...Intl.supportedValuesOf('timeZone'),
];

/**
 * O `enableImplicitConversion` do class-transformer converte com `Boolean(v)`,
 * e `Boolean('false')` é `true`. Por isso o parsing é explícito: só a string
 * `'true'` liga; ausente cai no padrão.
 */
function toBoolean(value: unknown, defaultValue: boolean): boolean {
  if (value === undefined || value === '') {
    return defaultValue;
  }
  return value === true || value === 'true';
}

/** `'true'`/`'false'` viram boolean; qualquer outro valor segue cru e falha em `@IsBoolean`. */
function parseStrictBoolean(value: unknown): unknown {
  if (value === true || value === 'true') {
    return true;
  }
  if (value === false || value === 'false') {
    return false;
  }
  return value;
}

function isBlank(value: unknown): boolean {
  return value === undefined || value === '';
}

/**
 * O issuer e a audience do OIDC são obrigatórios, exceto no e2e (token de
 * teste) e em `local` com o usuário mock ligado (ADR-003).
 */
function requiresOidc(config: EnvironmentVariables): boolean {
  if (config.STAGE === Stage.E2e) {
    return false;
  }
  return !(config.STAGE === Stage.Local && config.AUTH_MOCK_ENABLED);
}

export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @IsEnum(Stage)
  STAGE: Stage = Stage.Local;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsIn(VALID_TIME_ZONES, {
    message:
      'APP_TIMEZONE deve ser um fuso IANA válido (ex.: America/Sao_Paulo)',
  })
  APP_TIMEZONE: string = 'America/Sao_Paulo';

  /**
   * CSV de origens permitidas. O padrão (`http://localhost:5173`) só existe em
   * `local`/`e2e`; fora deles a variável é obrigatória (preenchida em `validate`).
   */
  @IsNotEmpty({
    message: 'CORS_ORIGINS é obrigatório quando STAGE não é local nem e2e',
  })
  CORS_ORIGINS: string;

  @IsEnum(LogLevel)
  LOG_LEVEL: LogLevel = LogLevel.Info;

  @IsInt()
  @Min(1)
  THROTTLE_LIMIT_PER_MINUTE: number = 300;

  @Transform(({ obj }) => toBoolean(obj.SWAGGER_ENABLED, true))
  @IsBoolean()
  SWAGGER_ENABLED: boolean = true;

  /**
   * Conexão com o Postgres, em variáveis separadas. Os padrões (`localhost:5433`,
   * usuário, senha e banco `pauta`) só existem em `local`; fora dele as cinco e
   * `DATABASE_SSL` são obrigatórias (preenchidas em `validate`).
   */
  @IsNotEmpty({
    message: 'DATABASE_HOST é obrigatória quando STAGE não é local',
  })
  DATABASE_HOST: string;

  @IsInt({
    message:
      'DATABASE_PORT deve ser um número inteiro entre 1 e 65535 (obrigatória quando STAGE não é local)',
  })
  @Min(1, {
    message:
      'DATABASE_PORT deve ser um número inteiro entre 1 e 65535 (obrigatória quando STAGE não é local)',
  })
  @Max(65535, {
    message:
      'DATABASE_PORT deve ser um número inteiro entre 1 e 65535 (obrigatória quando STAGE não é local)',
  })
  DATABASE_PORT: number;

  @IsNotEmpty({
    message: 'DATABASE_USER é obrigatória quando STAGE não é local',
  })
  DATABASE_USER: string;

  @IsNotEmpty({
    message: 'DATABASE_PASS é obrigatória quando STAGE não é local',
  })
  DATABASE_PASS: string;

  @IsNotEmpty({
    message: 'DATABASE_NAME é obrigatória quando STAGE não é local',
  })
  DATABASE_NAME: string;

  /**
   * TLS na conexão: `true` para Neon/produção, `false` no Postgres local.
   * Parsing estrito (só `true` ou `false`) e sem padrão fora de `local`, para
   * ninguém subir em produção sem TLS por esquecimento.
   */
  @Transform(({ obj }) => parseStrictBoolean(obj.DATABASE_SSL))
  @IsBoolean({
    message:
      'DATABASE_SSL deve ser true ou false (obrigatória quando STAGE não é local)',
  })
  DATABASE_SSL: boolean;

  /** Só tem efeito com `DATABASE_SSL=true`. */
  @Transform(({ obj }) => toBoolean(obj.DATABASE_SSL_REJECT_UNAUTHORIZED, true))
  @IsBoolean()
  DATABASE_SSL_REJECT_UNAUTHORIZED: boolean = true;

  @IsInt()
  @Min(1)
  DATABASE_POOL_MAX: number = 10;

  /** Issuer do Keycloak (ex.: `http://localhost:8080/realms/bora`). */
  @ValidateIf(
    (c: EnvironmentVariables) => requiresOidc(c) || !!c.OIDC_ISSUER_URL,
  )
  @IsNotEmpty({
    message:
      'OIDC_ISSUER_URL é obrigatória, exceto com STAGE=e2e ou STAGE=local com AUTH_MOCK_ENABLED=true',
  })
  @Matches(/^https?:\/\//, {
    message: 'OIDC_ISSUER_URL deve começar com http:// ou https://',
  })
  OIDC_ISSUER_URL?: string;

  /** CSV de audiences aceitas; o `aud` do token precisa conter alguma. */
  @ValidateIf((c: EnvironmentVariables) => requiresOidc(c))
  @IsNotEmpty({
    message:
      'OIDC_AUDIENCE é obrigatória, exceto com STAGE=e2e ou STAGE=local com AUTH_MOCK_ENABLED=true',
  })
  OIDC_AUDIENCE?: string;

  /** Opcional: padrão `${OIDC_ISSUER_URL}/protocol/openid-connect/certs`. */
  @ValidateIf((c: EnvironmentVariables) => !!c.OIDC_JWKS_URI)
  @Matches(/^https?:\/\//, {
    message: 'OIDC_JWKS_URI deve começar com http:// ou https://',
  })
  OIDC_JWKS_URI?: string;

  /** Caminho com ponto da claim que lista os papéis do usuário. */
  @IsNotEmpty({ message: 'OIDC_ROLES_CLAIM não pode ser vazia' })
  OIDC_ROLES_CLAIM: string = 'realm_access.roles';

  /** Liga o usuário mock; só é aceito com `STAGE=local` (ver `validate`). */
  @Transform(({ obj }) => toBoolean(obj.AUTH_MOCK_ENABLED, false))
  @IsBoolean()
  AUTH_MOCK_ENABLED: boolean = false;

  @IsIn(KNOWN_ROLES, {
    message: `AUTH_MOCK_ROLE deve ser um destes papéis: ${KNOWN_ROLES.join(', ')}`,
  })
  AUTH_MOCK_ROLE: Role = Role.Editor;
}

/** Tipo usado em `ConfigService<Env, true>` com `{ infer: true }`. */
export type Env = EnvironmentVariables;

export function validate(config: Record<string, unknown>): Env {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  if (
    (validated.CORS_ORIGINS === undefined || validated.CORS_ORIGINS === '') &&
    STAGES_WITH_DEFAULT_CORS.includes(validated.STAGE)
  ) {
    validated.CORS_ORIGINS = DEFAULT_CORS_ORIGINS;
  }

  if (validated.STAGE === Stage.Local) {
    for (const key of Object.keys(DATABASE_DEFAULTS_LOCAL) as Array<
      keyof typeof DATABASE_DEFAULTS_LOCAL
    >) {
      if (isBlank(config[key])) {
        Object.assign(validated, { [key]: DATABASE_DEFAULTS_LOCAL[key] });
      }
    }
  }

  const errors = validateSync(validated, { skipMissingProperties: false });
  const details = errors.map(
    (error) =>
      ` - ${error.property}: ${[...new Set(Object.values(error.constraints ?? {}))].join('; ')}`,
  );

  // Trava de segurança: o usuário mock nunca pode existir fora de `local`.
  if (validated.AUTH_MOCK_ENABLED === true && validated.STAGE !== Stage.Local) {
    details.push(
      ` - AUTH_MOCK_ENABLED: só pode ser true com STAGE=local (STAGE atual: ${validated.STAGE})`,
    );
  }

  if (details.length > 0) {
    throw new Error(
      `Configuração de ambiente inválida:\n${details.join('\n')}`,
    );
  }

  return validated;
}
